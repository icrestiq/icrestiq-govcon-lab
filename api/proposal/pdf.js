// api/proposal/pdf.js
//
// Server-side proposal PDF export with real, trustworthy TOC and
// Compliance Matrix page numbers.
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
// This endpoint sidesteps prediction entirely by rendering twice with a
// real headless Chromium (the exact browser doing the real pagination) and
// reading the answer back out of the actual finished PDF rather than
// guessing at it beforehand:
//
//   Pass 1 — render the proposal with no page numbers in the TOC/Matrix
//   (they're not known yet), but with an invisible, uniquely-tokened
//   marker at the top of every heading. Print it to a real PDF. Scan that
//   PDF's actual per-page text (via pdfjs) for each token to learn which
//   page Chromium's own layout put each heading on.
//
//   Pass 2 — render again, identical HTML/CSS (so nothing shifts height
//   between passes), this time with those real page numbers filled into
//   the TOC and Compliance Matrix. This is the PDF actually returned.
//
// One known edge case: if adding page numbers to the TOC itself changes
// its height enough to push a later heading onto a different page (rare —
// appending " (p. 6)" to a line essentially never wraps it), that specific
// number could be off by one in pass 2. Re-scanning pass 2's own output a
// third time would close that gap completely, but doubles render time for
// a genuinely rare case; not done here. Flagged in case it ever matters.

import { renderProposalHtml } from "../../src/lib/renderProposalHtml.js";

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

    // ── Pass 1: discover real page numbers ──
    const draftHtml = renderProposalHtml(data, logoUrl, totalPrice, { pageNumbers: null });
    const draftPdf = await renderPdf(browser, draftHtml, footerSolNum);
    const pageNumbers = await extractPageNumbers(draftPdf);

    // ── Pass 2: final render with real numbers filled in ──
    const finalHtml = renderProposalHtml(data, logoUrl, totalPrice, { pageNumbers });
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