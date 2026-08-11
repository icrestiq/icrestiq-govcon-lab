// api/proposal/pdf.js
//
// Server-side proposal PDF export with real, trustworthy TOC and
// Compliance Matrix page numbers, and no internal markers left in the
// delivered file.
//
// Why this exists: the in-browser "Print / Save as PDF" button (still the
// default, still instant) can't know its own final page numbers ahead of
// rendering — an earlier version of this app tried to predict them by
// measuring section heights in a hidden clone before printing, and that
// prediction broke down whenever a section landed close to a page
// boundary, in which case it had no way to know which side of the break
// it would land on and had to blank the numbers rather than risk showing
// a wrong one.
//
// This endpoint sidesteps prediction by rendering with a real headless
// Chromium (the exact browser doing the real pagination) and reading the
// answer back out of the actual finished PDF rather than guessing at it
// beforehand — see resolvePageNumbers below for how that resolution
// actually converges to something self-consistent rather than trusting a
// single measurement.

import { renderProposalHtml } from "../../src/lib/renderProposalHtml.js";
import { assertProposalTotalsMatch } from "../../src/lib/validateProposal.js";

// pdfjs-dist loads its parsing engine through a separate "worker" module
// (pdf.worker.mjs) — even in Node, where there's no real Worker thread,
// it still dynamically imports that same file to run as a "fake worker"
// in-process. That dynamic import path is invisible to Vercel's static
// file tracer, which decides what to include in the deployed function
// bundle by following actual import/require statements it can see at
// build time — so the worker file was silently left out, and the
// function crashed at runtime with "Cannot find module
// .../pdf.worker.mjs" (confirmed from the production error log). This
// import does nothing on its own — it's never referenced below — its
// only job is to give the tracer a static import it CAN see, so it
// bundles the file. Confirmed locally, using Vercel's own tracer
// (@vercel/nft) against this exact file: absent, the worker module is
// excluded; with it, included. Also confirmed the import itself is inert
// or Node — it doesn't throw or register anything global, so it's safe
// as a plain side-effect import; pdfjs-dist's own "fake worker" path
// relies on being able to import this same file directly, in-process,
// so this is expected, supported usage rather than a hack.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";

// @sparticuz/chromium only unpacks and wires up the shared libraries
// Chromium needs (libnss3.so among them) when it detects it's running
// inside a Lambda-shaped Node 20+/22+ container — it checks for
// AWS_EXECUTION_ENV or AWS_LAMBDA_JS_RUNTIME containing "20.x"/"22.x"
// (see @sparticuz/chromium/build/helper.js, isRunningInAwsLambdaNode20)
// in a block that runs ONCE, at module import time, not per-request.
// Vercel's functions run on the same kind of container but don't set
// either variable, so that check silently fails, the AL2023 library pack
// never gets extracted, and Chromium fails to launch with "libnss3.so:
// cannot open shared object file" — confirmed from the actual production
// error log.
//
// A first attempt at this fix set the env var as a plain statement below
// a static `import chromium from "@sparticuz/chromium"` — and still
// failed the same way in production, because ES module imports are
// hoisted and fully evaluated before any of the importing file's own
// top-level code runs, static-import position in the file is irrelevant.
// So chromium's module-level detection ran (and failed) before this env
// var was ever set, no matter where the assignment line sat in the file.
// Confirmed by reproducing that exact ordering locally: LD_LIBRARY_PATH
// came back undefined every time with a static import, and correctly
// populated once chromium was imported dynamically instead — a dynamic
// `import()` only runs at the point it's actually called in the code, so
// doing it inside the handler, after this assignment, guarantees the
// ordering actually holds.
process.env.AWS_LAMBDA_JS_RUNTIME ??= "nodejs22.x";

export const config = {
  maxDuration: 60,
};

async function extractPageNumbers(pdfBuffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const pageNumbers = {};
  const tokenRe = /\u00abPMARK:([a-zA-Z0-9-]+)\u00bb/g;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => it.str).join("");
    let m;
    while ((m = tokenRe.exec(text))) {
      // First page a marker appears on wins — a heading can only start
      // once, and this guards against the (rare) case its token text
      // gets duplicated by a page's continuation layout.
      if (!(m[1] in pageNumbers)) pageNumbers[m[1]] = i;
    }
  }
  return pageNumbers;
}

async function renderPdf(browser, html, footerSolNum) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "1in", bottom: "0.85in", left: "1in", right: "1in" },
      displayHeaderFooter: true,
      headerTemplate: `<span></span>`,
      footerTemplate: `
        <div style="width:100%;font-family:'Space Grotesk',sans-serif;font-size:9pt;color:#333;padding:0 1in;display:flex;justify-content:space-between;">
          <span>Solicitation No. ${footerSolNum}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
    return pdf;
  } finally {
    await page.close();
  }
}

// Resolves TOC / Compliance Matrix page numbers to a fixed point instead
// of trusting a single measurement.
//
// THE BUG THIS REPLACES: a two-pass version of this rendered once with no
// page numbers to measure where headings landed, then rendered again with
// those numbers filled into the TOC and Matrix — and returned that second
// render unconditionally, on the assumption that filling in the numbers
// couldn't meaningfully change anything above where they were measured.
// That assumption breaks whenever adding " (p. 6)" (or, on a long enough
// document, " (p. 14)") to a Compliance Matrix row or TOC line pushes
// that line onto a second line — confirmed by reproducing it directly: a
// large-enough Compliance Matrix, referencing a section repeatedly, grew
// tall enough between passes to push "3. Technical Approach" from the
// page it was measured on straight onto the next one, while the TOC and
// Matrix — built from the first pass's now-stale measurement — kept
// showing the old number. Every other entry was unaffected because
// nothing else happened to sit close enough to that particular page
// boundary to be pushed over it.
//
// THE FIX: after every render, re-measure the SAME render's own output.
// If what was used to build a render matches what that render actually
// contains, the numbers are self-consistent and safe to deliver — stop.
// If not, the new measurement becomes the next attempt's input, and it
// tries again. Capped at MAX_ATTEMPTS renders (each is a few seconds; a
// document that hasn't stabilized in that many attempts is treated as
// unable to resolve, not looped on indefinitely). Any id that's still
// disagreeing with itself when the cap is hit is marked unresolved and
// prints as an em dash in one final render — never a number that was
// measured but never actually confirmed against the file being handed
// back.
async function resolvePageNumbers(browser, data, logoUrl, totalPrice, footerSolNum) {
  const MAX_ATTEMPTS = 4;
  let pageNumbers = null;
  let html, pdf, measured;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    html = renderProposalHtml(data, logoUrl, totalPrice, { pageNumbers, includeMarkers: true });
    pdf = await renderPdf(browser, html, footerSolNum);
    measured = await extractPageNumbers(pdf);

    if (pageNumbers !== null) {
      const usedKeys = Object.keys(pageNumbers);
      const selfConsistent = usedKeys.length > 0 && usedKeys.every((id) => pageNumbers[id] === measured[id]);
      if (selfConsistent) {
        return { pageNumbers, unresolvedCount: 0 };
      }
    }
    pageNumbers = measured;
  }

  // Didn't reach a fixed point within the attempt cap. `pageNumbers` here
  // is what the LAST render was built from; `measured` is what that same
  // render actually turned out to contain. Anywhere those still disagree
  // is genuinely unresolved — mark it with the em-dash sentinel rather
  // than shipping a number that was never confirmed.
  const finalMap = {};
  let unresolvedCount = 0;
  for (const id of Object.keys(measured)) {
    if (pageNumbers[id] === measured[id]) {
      finalMap[id] = measured[id];
    } else {
      finalMap[id] = "\u2014";
      unresolvedCount++;
    }
  }
  return { pageNumbers: finalMap, unresolvedCount };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { data, logoUrl, totalPrice } = req.body || {};
  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "Missing proposal data" });
    return;
  }

  // Same pre-export check as the Word export (see validateProposal.js) —
  // this endpoint is a second, independent export path, so it needs its
  // own call rather than relying on the client having already checked.
  // A blocked validation is a 400 (the request itself is invalid — bad
  // input, not a server failure), not a 500.
  try {
    assertProposalTotalsMatch(data);
  } catch (err) {
    if (err.isValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  // Puppeteer's footerTemplate doesn't support arbitrary server-side
  // interpolation of app data (it's a static template Chromium repeats on
  // every page), so the solicitation number is baked into the footer HTML
  // string directly rather than passed as a token.
  const footerSolNum = (data.solicitationNumber || "\u2014").replace(/[<>&"]/g, "");

  let browser;
  try {
    // Dynamic imports, not static ones — see the comment above the
    // AWS_LAMBDA_JS_RUNTIME assignment for why this matters here
    // specifically: these two modules must load after that env var is
    // set, and only a dynamic import (evaluated at this exact point in
    // the code) guarantees that ordering.
    const { default: puppeteer } = await import("puppeteer-core");
    const { default: chromium } = await import("@sparticuz/chromium");

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const { pageNumbers, unresolvedCount } = await resolvePageNumbers(browser, data, logoUrl, totalPrice, footerSolNum);
    if (unresolvedCount > 0) {
      console.warn(`Proposal PDF: ${unresolvedCount} section(s) could not resolve a stable page number after retrying; printed as em dash.`);
    }

    // The render actually delivered to the user. includeMarkers: false —
    // no PMARK token reaches this HTML at all, so none can reach the
    // exported PDF's text layer. Not re-verified against a fresh
    // measurement afterward, because doing so is impossible by
    // construction (there are no marker tokens left to scan for) — this
    // relies on removing a set of near-zero-height, near-zero-width
    // invisible spans not being able to meaningfully change page breaks,
    // which is the same property that made them safe to treat as
    // effectively weightless during measurement in the first place.
    const finalHtml = renderProposalHtml(data, logoUrl, totalPrice, { pageNumbers, includeMarkers: false });
    const finalPdfRaw = await renderPdf(browser, finalHtml, footerSolNum);

    const fileSafeName = (data.companyName || "proposal").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileSafeName}-proposal.pdf"`);
    res.status(200).send(Buffer.from(finalPdfRaw));
  } catch (err) {
    console.error("Proposal PDF generation error:", err);
    res.status(500).json({ error: "Could not generate PDF. Please try again." });
  } finally {
    if (browser) await browser.close();
  }
}