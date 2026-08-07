import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { isPaidMember } from "../lib/tier";
import { computeExtended, computeGrandTotal, formatCurrency } from "../lib/pricing";
import { isValidNaicsCode, getNaicsTitle, searchNaics, MAX_NAICS_SELECTIONS } from "../lib/naics";
import { buildOutline, outlineDropdownOptions, findOutlineLabel } from "../lib/outline";
import { migrateProseList, isLegacyProseListValue } from "../lib/proseList";

/**
 * GovCon Lab — Proposal Builder
 * Route: /tools/proposal-builder (rendered inside the protected Layout,
 * so a signed-out visitor never reaches this file at all — see App.jsx)
 *
 * Gating: any paid tier (member / pro / founding) or admin can use it.
 * Free-tier members see an upgrade prompt instead of the form.

 *
 * REQUIRES (Supabase SQL already provided separately):
 *   1. Table `proposal_drafts` (id, user_id, data jsonb, logo_url, updated_at)
 *   2. Storage bucket `proposal-logos` (public read, user-scoped write) —
 *      also holds signature images now, at {userId}/signature.{ext};
 *      same bucket, same folder-scoped policy, just a different filename.
 */

const NAVY = "#1F3864";
const GOLD = "#B08D57";
const PAPER = "#FDFCFA";

// Fixed list — "Unit chosen from a fixed list," not free text, so a CLIN
// line can't end up with an inconsistent or misspelled unit of measure.
const UNIT_OPTIONS = ["EA", "SET", "KIT", "PR", "HR", "LOT", "DZ", "BOX", "CS", "GAL", "LB", "FT", "YD", "RL", "MO", "DAY"];

const FOB_OPTIONS = ["FOB Destination", "FOB Origin"];

const CONTRACT_TYPE_OPTIONS = ["FFP", "IDIQ", "BPA", "Purchase Order"];
const PRIME_SUB_OPTIONS = ["Prime", "Subcontractor"];
const SET_ASIDE_OPTIONS = ["8(a)", "HUBZone", "WOSB", "EDWOSB", "SDVOSB", "VOSB"];

const MAX_LOGO_MB = 2;
const MAX_LOGO_BYTES = MAX_LOGO_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_LABEL = "PNG, JPG, or WEBP";

const emptyPersonnel = () => ({ name: "", role: "", experience: "", allocation: "" });
const emptyClin = () => ({ clin: "", description: "", quantity: "", unitOfMeasure: "", unitPrice: "" });
const emptyPastPerf = () => ({
  contractNumber: "", agency: "", period: "", value: "", scope: "", reference: "",
  relevance: "", referenceEmail: "", contractType: "", primeOrSub: "", cpars: "",
});
const emptyDeliveryRow = () => ({ clin: "", destination: "", quantity: "", daysAfterReceipt: "", deliveryDate: "" });

const initialState = {
  companyName: "",
  companyAddress: "",
  uei: "",
  cageCode: "",
  solicitationNumber: "",
  solicitationTitle: "",
  solicitationDueDate: "",
  agencyName: "",
  contractingOfficer: "",
  agencyAddress: "",
  poc: "",
  pocTitle: "",
  phone: "",
  email: "",
  submissionDate: "",
  requirementSummary: "",
  winThemes: "",
  companySnapshot: "",
  methodology: "",
  qualityControl: { intro: "", items: [], closing: "" },
  riskManagement: { intro: "", items: [], closing: "" },
  personnel: [emptyPersonnel()],
  pastPerformance: [emptyPastPerf()],
  pricing: [emptyClin()],
  basisOfEstimate: "",
  assumptions: "", // one per line, rendered after Basis of Estimate
  fobTerm: "", // user-selected: "FOB Destination" or "FOB Origin" — blank until chosen, never defaulted
  // "Never print the no-exceptions statement by default" — starts false
  // (unchecked) and stays that way until the user explicitly checks it.
  noExceptions: false,
  exceptionsText: "",
  // Fully optional sections — each entirely absent from the outline and
  // the printed body until the user puts something in it.
  deliverySchedule: [],
  warrantyPeriod: "",
  warrantyTerms: "",
  samRegistrationActive: false,
  samExpirationDate: "",
  setAsideCategories: [],
  businessSize: "",
  naicsCodes: [],              // array of NAICS code strings, in selection order
  legacyNaicsText: "",         // raw text from the old free-text field, preserved as-is
  unverifiedNaicsEntries: [],  // lines from legacy text that didn't resolve to a real code
  complianceRows: [],          // optional Compliance Cross-Reference Matrix rows
};

const emptyComplianceRow = () => ({
  id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  solicitationRef: "", requirement: "", sectionId: "",
});

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#3a3a3a", marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", border: "1px solid #d4d4d4",
  borderRadius: 4, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
};
const textareaStyle = { ...inputStyle, minHeight: 70, resize: "vertical" };

function SectionCard({ title, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20, marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 14px 0", fontSize: 15, color: NAVY, borderBottom: `2px solid ${GOLD}`, paddingBottom: 8 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

const addBtnStyle = {
  background: "none", border: `1px solid ${NAVY}`, color: NAVY, borderRadius: 4,
  padding: "6px 12px", fontSize: 13, cursor: "pointer", marginTop: 4,
};
const removeBtnStyle = {
  background: "none", border: "1px solid #c44", color: "#c44", borderRadius: 4,
  padding: "8px 10px", fontSize: 12, cursor: "pointer", height: 36,
};

// ---------------------------------------------------------------------
// Logo upload
// ---------------------------------------------------------------------
function LogoUpload({ logoUrl, onUploaded, userId }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    setError("");
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`File type not supported. Please upload a ${ACCEPTED_LABEL} file.`);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_LOGO_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proposal-logos")
        .upload(path, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("proposal-logos").getPublicUrl(path);
      // cache-bust so a re-upload with the same filename shows immediately
      onUploaded(`${data.publicUrl}?t=${Date.now()}`);
    } catch (e) {
      setError("Upload failed. Please try again.");
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
        {logoUrl ? (
          <img src={logoUrl} alt="Company logo" style={{ maxHeight: 60, maxWidth: 160, objectFit: "contain", border: "1px solid #eee", borderRadius: 4, padding: 6 }} />
        ) : (
          <div style={{ height: 60, width: 100, border: "1px dashed #ccc", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#999", textAlign: "center" }}>
            No logo yet
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{ ...addBtnStyle, cursor: uploading ? "wait" : "pointer" }}
          >
            {uploading ? "Uploading…" : logoUrl ? "Replace Logo" : "Upload Logo"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#777", margin: "4px 0 0 0", lineHeight: 1.5 }}>
        Accepted formats: {ACCEPTED_LABEL}. Maximum file size: {MAX_LOGO_MB}MB.
        For best results on the printed proposal, use a horizontal logo at least 300px wide with a
        transparent or white background.
      </p>
      {error && <p style={{ fontSize: 12, color: "#c44", marginTop: 6 }}>{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------
// NAICS selector — searchable multi-select. The title is always looked up
// from the dataset (src/lib/naics.js), never typed by the user, so a
// selected code can never print alongside the wrong title.
// ---------------------------------------------------------------------
function NaicsSelector({ selected, onChange }) {
  const [query, setQuery] = useState("");
  const results = query.trim() ? searchNaics(query) : [];
  const atLimit = selected.length >= MAX_NAICS_SELECTIONS;

  // TEMPORARY diagnostic logging — remove once the reported bug (selected
  // NAICS code not showing up / not persisting) is confirmed fixed.

  const lastAddAtRef = useRef(0);
  const addCode = (code) => {
    if (atLimit || selected.includes(code)) return;
    const next = [...selected, code];
    lastAddAtRef.current = Date.now();
    onChange(next);
    setQuery("");
  };
  // Confirmed via a live console trace: a second interaction fires
  // immediately after addCode and lands on a chip's remove button,
  // silently undoing a selection the instant it's made. With one chip
  // already present, that phantom event was found to land on whichever
  // chip's × happens to be under it after the layout shifts — not
  // necessarily the code that was just added — so the guard has to
  // suppress any remove right after any add, not just of the same code.
  // A real, deliberate removal click this fast after adding a different
  // code is not a realistic user action; the spurious one is exactly
  // this shape every time.
  const removeCode = (code) => {
    if (Date.now() - lastAddAtRef.current < 1000) return;
    onChange(selected.filter((c) => c !== code));
  };

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selected.map((code) => (
            <span
              key={code}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#EEF1F8", border: `1px solid ${NAVY}33`, borderRadius: 100,
                padding: "4px 6px 4px 12px", fontSize: 12, color: NAVY,
              }}
            >
              <strong>{code}</strong> — {getNaicsTitle(code)}
              <button
                type="button"
                onClick={() => removeCode(code)}
                aria-label={`Remove ${code}`}
                style={{
                  background: "none", border: "none", color: NAVY, cursor: "pointer",
                  fontSize: 14, lineHeight: 1, padding: "2px 4px",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {atLimit ? (
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
          Maximum of {MAX_NAICS_SELECTIONS} codes selected. Remove one to add another.
        </p>
      ) : (
        <>
          <input
            style={inputStyle}
            placeholder="Search by code (e.g. 315210) or keyword (e.g. apparel)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div style={{ border: "1px solid #d4d4d4", borderRadius: 4, marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
              {results.map((r) => (
                <div
                  key={r.code}
                  onClick={() => addCode(r.code)}
                  style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #eee", fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f7f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <strong>{r.code}</strong> — {r.title}
                </div>
              ))}
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>No matching NAICS code found.</p>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Upgrade prompt for free-tier members
// ---------------------------------------------------------------------
function UpgradePrompt() {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
      <h2 style={{ color: NAVY, fontSize: 22, margin: "0 0 10px 0" }}>Proposal Builder is a paid member benefit</h2>
      <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
        Upgrade your membership to unlock the Proposal Builder and generate print-ready,
        government-contract proposals in minutes.
      </p>
      <a href="/membership" className="btn btn-primary" style={{ display: "inline-block", padding: "12px 28px", fontSize: 15 }}>
        View Membership Plans →
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------
export default function ProposalBuilder() {
  const { profile, isAdmin } = useAuth();
  // Tracks whether the user has made any edit yet. This exists because
  // the draft-load effect below is async (two sequential Supabase round
  // trips: getUser(), then the proposal_drafts SELECT) and, once it
  // resolves, unconditionally overwrites the entire `data` object with
  // whatever it loaded. If the user interacts with the form — e.g.
  // searching for and clicking a NAICS code — before that load finishes,
  // the load's setData(merged) call fires AFTER the click's own
  // setData(...) and silently wipes out the edit, even though the click
  // handler itself ran correctly. Wrapping setState here means every
  // existing setData(...) call site in this file (there are many: set(),
  // updateList(), addRow(), the NAICS selector's onChange, the signature
  // upload callback, etc.) automatically marks this without needing to
  // touch each one individually.
  const hasUserEditedRef = useRef(false);
  const [data, setDataRaw] = useState(initialState);
  const setData = useCallback((updater) => {
    hasUserEditedRef.current = true;
    setDataRaw(updater);
  }, []);
  const [logoUrl, setLogoUrl] = useState(null);
  const [mode, setMode] = useState("form");
  const [userId, setUserId] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [saveStatus, setSaveStatus] = useState(""); // "", "saving", "saved", "error"
  const saveTimer = useRef(null);

  // Load user + existing draft on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: drafts, error } = await supabase
        .from("proposal_drafts")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!error && drafts && drafts.length > 0) {
        const draft = drafts[0];
        setDraftId(draft.id);

        // If the user has already started editing by the time this load
        // resolves, do not clobber their in-progress work with a stale
        // server snapshot — this is the actual fix for the race described
        // above. draftId above is still set (needed so the next autosave
        // updates this row instead of inserting a duplicate), but the
        // content itself is left alone.
        if (hasUserEditedRef.current) {
          return;
        }

        const merged = { ...initialState, ...draft.data };

        // Migration: pre-selector drafts stored free-text NAICS in `naics`,
        // one entry per line (often "CODE – hand-typed title"). If this
        // draft predates the selector, try to salvage any line that starts
        // with a real code — using the official title, not whatever text
        // followed it, since a mismatched hand-typed title next to a real
        // code is exactly the bug this migration exists to fix. Anything
        // that doesn't resolve gets flagged, never silently kept or
        // silently dropped.
        if (draft.data.naics && (!draft.data.naicsCodes || draft.data.naicsCodes.length === 0)) {
          const lines = String(draft.data.naics).split("\n").map(s => s.trim()).filter(Boolean);
          const migratedCodes = [];
          const unverified = [];
          for (const line of lines) {
            const match = line.match(/^(\d{2,6})\b/);
            if (match && isValidNaicsCode(match[1])) {
              if (!migratedCodes.includes(match[1])) migratedCodes.push(match[1]);
            } else {
              unverified.push(line);
            }
          }
          merged.naicsCodes = migratedCodes.slice(0, MAX_NAICS_SELECTIONS);
          merged.legacyNaicsText = draft.data.naics;
          merged.unverifiedNaicsEntries = unverified;
        }

        // Migration: pre-restructure drafts stored Quality Control Plan and
        // Risk Management as a single free-text field (one line per
        // "item" under the old convention, but really a mix of prose and
        // real items — see migrateProseList's own comment for the
        // classification rule). Convert to the new
        // { intro, items, closing } shape on load; the next autosave
        // persists the migrated shape back to Supabase.
        if (isLegacyProseListValue(draft.data.qualityControl)) {
          merged.qualityControl = migrateProseList(draft.data.qualityControl);
        }
        if (isLegacyProseListValue(draft.data.riskManagement)) {
          merged.riskManagement = migrateProseList(draft.data.riskManagement);
        }

        setData(merged);
        if (draft.logo_url) setLogoUrl(draft.logo_url);
      }
    })();
  }, []);

  // Debounced autosave whenever form data or logo changes
  const saveDraft = useCallback(async (nextData, nextLogoUrl) => {
    if (!userId) return;
    setSaveStatus("saving");
    try {
      const payload = { user_id: userId, data: nextData, logo_url: nextLogoUrl, updated_at: new Date().toISOString() };
      if (draftId) {
        const { error } = await supabase.from("proposal_drafts").update(payload).eq("id", draftId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("proposal_drafts").insert(payload).select().single();
        if (error) throw error;
        setDraftId(inserted.id);
      }
      setSaveStatus("saved");
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
    }
  }, [userId, draftId]);

  useEffect(() => {
    if (!userId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(data, logoUrl), 1200);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, logoUrl, userId]);

  const set = (key) => (e) => setData((d) => ({ ...d, [key]: e.target.value }));
  const setProseListPart = (sectionKey, part) => (e) => {
    const raw = e.target.value;
    setData((d) => ({
      ...d,
      [sectionKey]: { ...d[sectionKey], [part]: part === "items" ? raw.split("\n") : raw },
    }));
  };
  const updateList = (listKey, idx, field, value) => {
    setData((d) => {
      const list = [...d[listKey]];
      list[idx] = { ...list[idx], [field]: value };
      return { ...d, [listKey]: list };
    });
  };
  const addRow = (listKey, factory) => setData((d) => ({ ...d, [listKey]: [...d[listKey], factory()] }));
  const removeRow = (listKey, idx) =>
    setData((d) => ({ ...d, [listKey]: d[listKey].filter((_, i) => i !== idx) }));

  const clearDraft = async () => {
    const confirmed = window.confirm(
      "Clear this draft? This will erase everything you've filled in and cannot be undone."
    );
    if (!confirmed) return;

    clearTimeout(saveTimer.current);
    setData(initialState);
    setLogoUrl(null);

    if (draftId) {
      try {
        setSaveStatus("saving");
        const { error } = await supabase.from("proposal_drafts").delete().eq("id", draftId);
        if (error) throw error;
        setDraftId(null);
        setSaveStatus("saved");
      } catch (e) {
        console.error(e);
        setSaveStatus("error");
      }
    } else {
      setSaveStatus("");
    }
  };

  const totalPrice = computeGrandTotal(data.pricing);
  const sectionOptions = outlineDropdownOptions(buildOutline(data));

  // Gate: free-tier members see an upgrade prompt instead of the tool
  if (!isAdmin && !isPaidMember(profile)) {
    return <UpgradePrompt />;
  }

  if (mode === "preview") {
    return <ProposalPreview data={data} logoUrl={logoUrl} totalPrice={totalPrice} onBack={() => setMode("form")} />;
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ color: NAVY, fontSize: 26, margin: "0 0 4px 0" }}>Proposal Builder</h1>
          <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
            Fill in your details below, then preview and print a ready-to-submit proposal draft.
          </p>
        </div>
        {userId && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: saveStatus === "error" ? "#c44" : "#888" }}>
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Draft saved"}
              {saveStatus === "error" && "Couldn't save draft"}
            </div>
            <button
              type="button"
              onClick={clearDraft}
              style={{
                background: "none", border: "1px solid #c44", color: "#c44", borderRadius: 4,
                padding: "6px 12px", fontSize: 12, cursor: "pointer",
              }}
            >
              Clear Draft
            </button>
          </div>
        )}
      </div>

      <div style={{
        background: "#EEF1F8", border: `1px solid ${NAVY}22`, borderRadius: 8,
        padding: "18px 20px", marginBottom: 20,
      }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: 14, color: NAVY }}>Quick Guide: How to Fill This Out</h3>
        <ul style={{ margin: "0 0 12px 0", paddingLeft: 20, fontSize: 13, color: "#3a3a3a", lineHeight: 1.7 }}>
          <li><strong>Company Info</strong> — copy your UEI, CAGE code, and set-aside status straight from SAM.gov.</li>
          <li><strong>Executive Summary</strong> — write win themes that are specific and provable, not slogans.</li>
          <li><strong>Technical Approach</strong> — mirror the solicitation's own deliverables and timeline.</li>
          <li><strong>Past Performance</strong> — pick references that are relevant in scope and size, not just recent.</li>
          <li><strong>Price Proposal</strong> — always include a basis of estimate; never submit numbers with no rationale.</li>
        </ul>
        <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
          Want the full section-by-section walkthrough, with examples and a pre-submission checklist?{" "}
          <a
            href="/store?q=Proposal%20Builder%20Playbook"
            style={{ color: GOLD, fontWeight: 600, textDecoration: "underline" }}
          >
            Get the Proposal Builder Playbook ebook in the Store →
          </a>
        </p>
      </div>

      <SectionCard title="Company Logo">
        {userId ? (
          <LogoUpload logoUrl={logoUrl} userId={userId} onUploaded={setLogoUrl} />
        ) : (
          <p style={{ fontSize: 13, color: "#888" }}>Sign in to upload a logo and save your progress.</p>
        )}
      </SectionCard>

      <SectionCard title="Company Information">
        <Field label="Company Name"><input style={inputStyle} value={data.companyName} onChange={set("companyName")} /></Field>
        <Field label="Company Address"><input style={inputStyle} value={data.companyAddress} onChange={set("companyAddress")} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="UEI"><input style={inputStyle} value={data.uei} onChange={set("uei")} /></Field>
          <Field label="CAGE Code"><input style={inputStyle} value={data.cageCode} onChange={set("cageCode")} /></Field>
        </div>
        <Field label="Business Size / Set-Aside Status"><input style={inputStyle} placeholder="e.g. Small Business, SDVOSB" value={data.businessSize} onChange={set("businessSize")} /></Field>
        <Field label={`NAICS Code(s) — up to ${MAX_NAICS_SELECTIONS}, searched and selected, never typed`}>
          <NaicsSelector
            selected={data.naicsCodes}
            onChange={(codes) => setData((d) => ({ ...d, naicsCodes: codes }))}
          />
        </Field>
        {data.unverifiedNaicsEntries.length > 0 && (
          <div style={{ background: "#FFF6E5", border: "1px solid #E0B34D66", borderRadius: 6, padding: "10px 14px", marginTop: 4 }}>
            <p style={{ margin: "0 0 6px 0", fontSize: 13, fontWeight: 600, color: "#8a6200" }}>
              Unverified NAICS — please reselect
            </p>
            <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#8a6200" }}>
              These were carried over from an older draft and couldn't be matched to a real NAICS code.
              They will not print until you reselect them above.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#8a6200" }}>
              {data.unverifiedNaicsEntries.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Solicitation & Submission">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Solicitation Number"><input style={inputStyle} value={data.solicitationNumber} onChange={set("solicitationNumber")} /></Field>
          <Field label="Solicitation Due Date"><input style={inputStyle} placeholder="e.g. May 15, 2025, 2:00 PM EDT" value={data.solicitationDueDate} onChange={set("solicitationDueDate")} /></Field>
          <Field label="Submission Date"><input style={inputStyle} type="date" value={data.submissionDate} onChange={set("submissionDate")} /></Field>
        </div>
        <Field label="Solicitation Title"><input style={inputStyle} value={data.solicitationTitle} onChange={set("solicitationTitle")} /></Field>
        <Field label="Contracting Agency"><input style={inputStyle} value={data.agencyName} onChange={set("agencyName")} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Contracting Officer"><input style={inputStyle} value={data.contractingOfficer} onChange={set("contractingOfficer")} /></Field>
          <Field label="Agency Address"><input style={inputStyle} value={data.agencyAddress} onChange={set("agencyAddress")} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Field label="Your Name"><input style={inputStyle} value={data.poc} onChange={set("poc")} /></Field>
          <Field label="Your Title"><input style={inputStyle} value={data.pocTitle} onChange={set("pocTitle")} /></Field>
          <Field label="Phone"><input style={inputStyle} value={data.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><input style={inputStyle} value={data.email} onChange={set("email")} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Cover Letter Exceptions">
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={data.noExceptions}
            onChange={(e) => setData((d) => ({ ...d, noExceptions: e.target.checked }))}
            style={{ marginTop: 3 }}
          />
          <span style={{ fontSize: 13, color: "#333" }}>
            We take no exception to the terms, conditions, and provisions of the solicitation.
            <br />
            <span style={{ fontSize: 11, color: "#888" }}>
              This is a binding representation — leave unchecked unless that's genuinely true.
            </span>
          </span>
        </label>

        {!data.noExceptions && (
          <Field label="Exceptions taken (optional) — describe any terms you're not agreeing to as written">
            <textarea style={textareaStyle} value={data.exceptionsText} onChange={set("exceptionsText")} />
          </Field>
        )}
      </SectionCard>

      <SectionCard title="Executive Summary">
        <Field label="Understanding of the Requirement"><textarea style={textareaStyle} value={data.requirementSummary} onChange={set("requirementSummary")} /></Field>
        <Field label="Win Themes (one per line)"><textarea style={textareaStyle} value={data.winThemes} onChange={set("winThemes")} /></Field>
        <Field label="Company Snapshot"><textarea style={textareaStyle} value={data.companySnapshot} onChange={set("companySnapshot")} /></Field>
      </SectionCard>

      <SectionCard title="Technical Approach">
        <Field label="Proposed Methodology"><textarea style={textareaStyle} value={data.methodology} onChange={set("methodology")} /></Field>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: "#555", margin: "16px 0 6px" }}>Quality Control Plan</h4>
        <Field label="Intro (optional) — the lead-in sentence, e.g. what gets inspected and why">
          <textarea style={textareaStyle} value={data.qualityControl.intro} onChange={setProseListPart("qualityControl", "intro")} />
        </Field>
        <Field label="Items (optional, one per line) — short bullet points only">
          <textarea style={textareaStyle} value={data.qualityControl.items.join("\n")} onChange={setProseListPart("qualityControl", "items")} />
        </Field>
        <Field label="Closing (optional) — any wrap-up sentence after the list">
          <textarea style={textareaStyle} value={data.qualityControl.closing} onChange={setProseListPart("qualityControl", "closing")} />
        </Field>

        <h4 style={{ fontSize: 13, fontWeight: 600, color: "#555", margin: "16px 0 6px" }}>Risk Management</h4>
        <Field label="Intro (optional)">
          <textarea style={textareaStyle} value={data.riskManagement.intro} onChange={setProseListPart("riskManagement", "intro")} />
        </Field>
        <Field label="Items (optional, one per line) — short bullet points only">
          <textarea style={textareaStyle} value={data.riskManagement.items.join("\n")} onChange={setProseListPart("riskManagement", "items")} />
        </Field>
        <Field label="Closing (optional)">
          <textarea style={textareaStyle} value={data.riskManagement.closing} onChange={setProseListPart("riskManagement", "closing")} />
        </Field>
      </SectionCard>

      <SectionCard title="Key Personnel">
        {data.personnel.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <Field label="Name"><input style={inputStyle} value={p.name} onChange={(e) => updateList("personnel", i, "name", e.target.value)} /></Field>
            <Field label="Role"><input style={inputStyle} value={p.role} onChange={(e) => updateList("personnel", i, "role", e.target.value)} /></Field>
            <Field label="Experience"><input style={inputStyle} value={p.experience} onChange={(e) => updateList("personnel", i, "experience", e.target.value)} /></Field>
            <Field label="% Allocation"><input style={inputStyle} value={p.allocation} onChange={(e) => updateList("personnel", i, "allocation", e.target.value)} /></Field>
            {data.personnel.length > 1 && (
              <button onClick={() => removeRow("personnel", i)} style={removeBtnStyle}>Remove</button>
            )}
          </div>
        ))}
        <button onClick={() => addRow("personnel", emptyPersonnel)} style={addBtnStyle}>+ Add Personnel</button>
      </SectionCard>

      <SectionCard title="Past Performance">
        {data.pastPerformance.map((pp, i) => (
          <div key={i} style={{ border: "1px solid #eee", borderRadius: 6, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Contract Number"><input style={inputStyle} value={pp.contractNumber} onChange={(e) => updateList("pastPerformance", i, "contractNumber", e.target.value)} /></Field>
              <Field label="Customer / Agency"><input style={inputStyle} value={pp.agency} onChange={(e) => updateList("pastPerformance", i, "agency", e.target.value)} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Period of Performance"><input style={inputStyle} value={pp.period} onChange={(e) => updateList("pastPerformance", i, "period", e.target.value)} /></Field>
              <Field label="Contract Value"><input style={inputStyle} value={pp.value} onChange={(e) => updateList("pastPerformance", i, "value", e.target.value)} /></Field>
            </div>
            <Field label="Scope"><textarea style={textareaStyle} value={pp.scope} onChange={(e) => updateList("pastPerformance", i, "scope", e.target.value)} /></Field>
            <Field label="Relevance to this requirement">
              <textarea
                style={textareaStyle}
                placeholder="Explain similarity in scope, dollar value, quantity, and complexity."
                value={pp.relevance}
                onChange={(e) => updateList("pastPerformance", i, "relevance", e.target.value)}
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Reference Contact"><input style={inputStyle} value={pp.reference} onChange={(e) => updateList("pastPerformance", i, "reference", e.target.value)} /></Field>
              <Field label="Reference Email"><input type="email" style={inputStyle} value={pp.referenceEmail} onChange={(e) => updateList("pastPerformance", i, "referenceEmail", e.target.value)} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Contract Type (optional)">
                <select style={inputStyle} value={pp.contractType} onChange={(e) => updateList("pastPerformance", i, "contractType", e.target.value)}>
                  <option value="">— Not specified —</option>
                  {CONTRACT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Prime or Subcontractor (optional)">
                <select style={inputStyle} value={pp.primeOrSub} onChange={(e) => updateList("pastPerformance", i, "primeOrSub", e.target.value)}>
                  <option value="">— Not specified —</option>
                  {PRIME_SUB_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="CPARS Rating (optional)">
                <input style={inputStyle} placeholder="e.g. Satisfactory" value={pp.cpars} onChange={(e) => updateList("pastPerformance", i, "cpars", e.target.value)} />
              </Field>
            </div>
            {data.pastPerformance.length > 1 && (
              <button onClick={() => removeRow("pastPerformance", i)} style={removeBtnStyle}>Remove</button>
            )}
          </div>
        ))}
        <button onClick={() => addRow("pastPerformance", emptyPastPerf)} style={addBtnStyle}>+ Add Contract Reference</button>
      </SectionCard>

      <SectionCard title="Price Proposal">
        {data.pricing.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "0.7fr 1.7fr 0.6fr 0.6fr 0.9fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <Field label="CLIN"><input style={inputStyle} value={row.clin} onChange={(e) => updateList("pricing", i, "clin", e.target.value)} /></Field>
            <Field label="Description"><input style={inputStyle} value={row.description} onChange={(e) => updateList("pricing", i, "description", e.target.value)} /></Field>
            <Field label="Quantity"><input type="number" style={inputStyle} value={row.quantity} onChange={(e) => updateList("pricing", i, "quantity", e.target.value)} /></Field>
            <Field label="Unit">
              <select style={inputStyle} value={row.unitOfMeasure} onChange={(e) => updateList("pricing", i, "unitOfMeasure", e.target.value)}>
                <option value="">— Select —</option>
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Unit Price"><input type="number" step="0.01" style={inputStyle} value={row.unitPrice} onChange={(e) => updateList("pricing", i, "unitPrice", e.target.value)} /></Field>
            <Field label="Ext. Price">
              <div style={{ ...inputStyle, background: "#f2f2f2", color: "#444", display: "flex", alignItems: "center" }}>
                {formatCurrency(computeExtended(row.quantity, row.unitPrice))}
              </div>
            </Field>
            {data.pricing.length > 1 && (
              <button onClick={() => removeRow("pricing", i)} style={removeBtnStyle}>Remove</button>
            )}
          </div>
        ))}
        <button onClick={() => addRow("pricing", emptyClin)} style={addBtnStyle}>+ Add Line Item</button>
        <div style={{ marginTop: 12, fontWeight: 600, color: NAVY }}>Total: {formatCurrency(totalPrice)}</div>
        <Field label="FOB Term — required for a firm-fixed-price line to be evaluable">
          <select style={inputStyle} value={data.fobTerm} onChange={set("fobTerm")}>
            <option value="">— Select —</option>
            {FOB_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Basis of Estimate"><textarea style={textareaStyle} value={data.basisOfEstimate} onChange={set("basisOfEstimate")} /></Field>
        <Field label="Assumptions (optional, one per line) — rendered after Basis of Estimate">
          <textarea style={textareaStyle} value={data.assumptions} onChange={set("assumptions")} />
        </Field>
      </SectionCard>

      <SectionCard title="Delivery Schedule (optional)">
        <p style={{ fontSize: 13, color: "#666", margin: "-6px 0 14px 0", lineHeight: 1.6 }}>
          Entirely optional — leave every row blank and this section won't appear in the printed proposal.
        </p>
        {data.deliverySchedule.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 0.7fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <Field label="CLIN"><input style={inputStyle} value={row.clin} onChange={(e) => updateList("deliverySchedule", i, "clin", e.target.value)} /></Field>
            <Field label="Destination"><input style={inputStyle} value={row.destination} onChange={(e) => updateList("deliverySchedule", i, "destination", e.target.value)} /></Field>
            <Field label="Quantity"><input style={inputStyle} value={row.quantity} onChange={(e) => updateList("deliverySchedule", i, "quantity", e.target.value)} /></Field>
            <Field label="Days After Receipt of Order">
              <input
                type="number" style={inputStyle} placeholder="e.g. 30"
                value={row.daysAfterReceipt}
                onChange={(e) => updateList("deliverySchedule", i, "daysAfterReceipt", e.target.value)}
              />
            </Field>
            <Field label="— or a Calendar Date">
              <input
                type="date" style={inputStyle}
                value={row.deliveryDate}
                onChange={(e) => updateList("deliverySchedule", i, "deliveryDate", e.target.value)}
              />
            </Field>
            <button onClick={() => removeRow("deliverySchedule", i)} style={removeBtnStyle}>Remove</button>
          </div>
        ))}
        {data.deliverySchedule.length > 0 && (
          <button onClick={() => addRow("deliverySchedule", emptyDeliveryRow)} style={addBtnStyle}>+ Add Another Row</button>
        )}
        {data.deliverySchedule.length === 0 && (
          <button onClick={() => addRow("deliverySchedule", emptyDeliveryRow)} style={addBtnStyle}>+ Add Delivery Row</button>
        )}
      </SectionCard>

      <SectionCard title="Warranty (optional)">
        <Field label="Warranty Period"><input style={inputStyle} placeholder="e.g. 12 months from acceptance" value={data.warrantyPeriod} onChange={set("warrantyPeriod")} /></Field>
        <Field label="Warranty Terms"><textarea style={textareaStyle} value={data.warrantyTerms} onChange={set("warrantyTerms")} /></Field>
      </SectionCard>

      <SectionCard title="Representations and Certifications (optional)">
        <p style={{ fontSize: 13, color: "#666", margin: "-6px 0 14px 0", lineHeight: 1.6 }}>
          Checkboxes only — only check categories your SAM.gov registration actually reflects. Nothing
          here is checked by default, and unchecked items print nothing at all.
        </p>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={data.samRegistrationActive}
            onChange={(e) => setData((d) => ({ ...d, samRegistrationActive: e.target.checked }))}
            style={{ marginTop: 3 }}
          />
          <span style={{ fontSize: 13, color: "#333" }}>SAM registration active</span>
        </label>
        {data.samRegistrationActive && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, marginLeft: 24 }}>
            <Field label="UEI (from Company Information above)">
              <div style={{ ...inputStyle, background: "#f2f2f2", color: "#444" }}>{data.uei || "— not entered above yet —"}</div>
            </Field>
            <Field label="SAM Expiration Date">
              <input type="date" style={inputStyle} value={data.samExpirationDate} onChange={set("samExpirationDate")} />
            </Field>
          </div>
        )}

        {data.businessSize && data.businessSize.trim() && (
          <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
            Business size ("{data.businessSize}") is already entered under Company Information and will
            print here too.
          </p>
        )}

        <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 600, color: "#3a3a3a" }}>Socioeconomic Set-Aside Categories Claimed</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {SET_ASIDE_OPTIONS.map((cat) => (
            <label key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={data.setAsideCategories.includes(cat)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setData((d) => ({
                    ...d,
                    setAsideCategories: checked
                      ? [...d.setAsideCategories, cat]
                      : d.setAsideCategories.filter((c) => c !== cat),
                  }));
                }}
              />
              {cat}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Compliance Cross-Reference Matrix (optional)">
        <p style={{ fontSize: 13, color: "#666", margin: "-6px 0 14px 0", lineHeight: 1.6 }}>
          Maps each solicitation requirement to where your proposal addresses it. Entirely optional —
          leave it empty and it won't appear in the printed proposal at all. Every row is yours to write;
          nothing here is generated for you.
        </p>
        {data.complianceRows.map((row, i) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.4fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <Field label="Solicitation Ref.">
              <input
                style={inputStyle} placeholder="e.g. L.3.2(a)"
                value={row.solicitationRef}
                onChange={(e) => updateList("complianceRows", i, "solicitationRef", e.target.value)}
              />
            </Field>
            <Field label="Requirement">
              <input
                style={inputStyle} placeholder="Your paraphrase of what's required"
                value={row.requirement}
                onChange={(e) => updateList("complianceRows", i, "requirement", e.target.value)}
              />
            </Field>
            <Field label="Proposal Section">
              <select
                style={inputStyle}
                value={row.sectionId}
                onChange={(e) => updateList("complianceRows", i, "sectionId", e.target.value)}
              >
                <option value="">— Select —</option>
                {sectionOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </Field>
            <button onClick={() => removeRow("complianceRows", i)} style={removeBtnStyle}>Remove</button>
          </div>
        ))}
        {sectionOptions.length === 0 && (
          <p style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
            Fill in at least one section above (Executive Summary, Technical Approach, etc.) before
            adding a row here — the section dropdown only lists sections you've actually written.
          </p>
        )}
        <button onClick={() => addRow("complianceRows", emptyComplianceRow)} style={addBtnStyle}>+ Add Row</button>
      </SectionCard>

      <div style={{ position: "sticky", bottom: 16, textAlign: "center", marginTop: 24 }}>
        <button
          onClick={() => setMode("preview")}
          style={{
            background: NAVY, color: "#fff", border: "none", borderRadius: 6,
            padding: "12px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          Preview Proposal →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Preview / print view
// ---------------------------------------------------------------------
function ProposalPreview({ data, logoUrl, totalPrice, onBack }) {
  const winThemeList = data.winThemes.split("\n").map(s => s.trim()).filter(Boolean);
  const naicsEntries = (data.naicsCodes || []).map((code) => ({ code, title: getNaicsTitle(code) }));
  const [docxGenerating, setDocxGenerating] = useState(false);
  const [docxError, setDocxError] = useState("");

  async function handleDownloadDocx() {
    setDocxGenerating(true);
    setDocxError("");
    try {
      const { generateProposalDocx } = await import("../lib/generateDocx");
      const blob = await generateProposalDocx(data, logoUrl, totalPrice);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileSafeName = (data.companyName || "proposal").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      a.download = `${fileSafeName}-proposal.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setDocxError("Could not generate the Word document. Please try again.");
    } finally {
      setDocxGenerating(false);
    }
  }

  const hasMatrix = Array.isArray(data.complianceRows) && data.complianceRows.length > 0;
  const outline = buildOutline(data);
  const numberOf = (id) => {
    for (const sec of outline) {
      if (sec.id === id) return sec.number;
      for (const sub of sec.subsections) if (sub.id === id) return sub.number;
    }
    return "";
  };

  const hasDeliverySchedule = outline.some((s) => s.id === "delivery-schedule");
  const hasWarranty = outline.some((s) => s.id === "warranty");
  const hasRepsCerts = outline.some((s) => s.id === "reps-certs");

  // Chrome's native print header/footer (when "Headers and footers" is
  // checked in the print dialog, which is its default) shows document.title
  // on one side and page numbers on the other. Setting the title here gives
  // a real fallback that will actually appear even where the @page margin
  // boxes below aren't supported — see the print-CSS comment for why both
  // exist. Restored on unmount so the rest of the app keeps its own title.
  useEffect(() => {
    const previous = document.title;
    document.title = data.solicitationNumber
      ? `Solicitation No. ${data.solicitationNumber}`
      : (data.solicitationTitle || previous);
    return () => { document.title = previous; };
  }, [data.solicitationNumber, data.solicitationTitle]);

  // ── Shared content renderers — called once for the hidden print-width
  // measurement clone and once for the visible document, so there's a
  // single source of truth and no risk of the two drifting apart. ──
  const renderLetterheadContent = () => (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      {logoUrl && (
        <img src={logoUrl} alt="Company logo" style={{ maxHeight: 80, maxWidth: 240, objectFit: "contain", marginBottom: 12 }} />
      )}
      <div style={{ fontWeight: "bold", fontSize: 22, color: NAVY, fontFamily: "'Space Grotesk', sans-serif" }}>{data.companyName || "[Company Name]"}</div>
      <div style={{ fontSize: 12, color: "#666" }}>
        {data.companyAddress} {data.uei && `| UEI: ${data.uei}`} {data.cageCode && `| CAGE: ${data.cageCode}`}
      </div>
      <div style={{ borderTop: `2px solid ${GOLD}`, borderBottom: `2px solid ${GOLD}`, margin: "16px 0", padding: "10px 0" }}>
        <div style={{ fontSize: 26, fontWeight: "bold", color: NAVY, fontFamily: "'Space Grotesk', sans-serif" }}>TECHNICAL &amp; PRICE PROPOSAL</div>
      </div>
      <div>In Response to Solicitation No. {data.solicitationNumber || "[Number]"}</div>
      <div style={{ fontStyle: "italic", color: "#555" }}>{data.solicitationTitle}</div>
    </div>
  );

  // Same content and visual language as the main title-page letterhead
  // (logo, name, address, UEI, CAGE) at reduced scale, without the
  // "TECHNICAL & PRICE PROPOSAL" banner — that stays on the title page
  // only. A cover letter should read as a complete standalone letter with
  // its own letterhead, not a continuation of the title page.
  const renderMiniLetterhead = () => (
    <div style={{ textAlign: "center", marginBottom: 24 }}>
      {logoUrl && (
        <img src={logoUrl} alt="Company logo" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", marginBottom: 8 }} />
      )}
      <div style={{ fontWeight: "bold", fontSize: 18, color: NAVY, fontFamily: "'Space Grotesk', sans-serif" }}>{data.companyName || "[Company Name]"}</div>
      <div style={{ fontSize: 11, color: "#666" }}>
        {data.companyAddress} {data.uei && `| UEI: ${data.uei}`} {data.cageCode && `| CAGE: ${data.cageCode}`}
      </div>
      <div style={{ borderBottom: `2px solid ${GOLD}`, margin: "12px 0 0 0" }} />
    </div>
  );

  const renderCoverLetterContent = () => (
    <>
      {renderMiniLetterhead()}
      <h2 style={{ borderBottom: "none" }}>Cover Letter</h2>
      <p>{data.submissionDate}</p>
      <p>{data.contractingOfficer}<br />{data.agencyName}<br />{data.agencyAddress}</p>
      <p>
        Subject: Proposal Submission for {data.solicitationTitle}<br />
        <strong>Solicitation No. {data.solicitationNumber || "[Number]"}</strong>
        {data.solicitationDueDate && <><br />Response Due: {data.solicitationDueDate}</>}
      </p>
      <p>Dear {data.contractingOfficer || "Contracting Officer"},</p>
      <p>{data.companyName} is pleased to submit the enclosed proposal in response to the above-referenced solicitation. We have reviewed the solicitation in its entirety and our proposal is fully compliant with the stated requirements, terms, and conditions.</p>

      {data.noExceptions ? (
        <p>We take no exception to the terms, conditions, and provisions of the solicitation.</p>
      ) : (
        data.exceptionsText && data.exceptionsText.trim() && (
          <>
            <h3>Exceptions</h3>
            <p>{data.exceptionsText.trim()}</p>
          </>
        )
      )}

      <p className="cover-signoff">Sincerely,</p>
      <div>
        <div style={{ height: "0.6in" }} />
        <div className="signature-rule" />
        <p className="cover-signature">{data.poc}<br />{data.pocTitle}<br />{data.phone} | {data.email}</p>
      </div>

      <p className="enclosures-line">Enclosures: {outline.map((s) => `${s.number}. ${s.title}`).join("; ")}</p>
    </>
  );

  const renderTOCContent = () => (
    <>
      <h2 style={{ borderBottom: "none" }}>Table of Contents</h2>
      <table>
        <tbody>
          {outline.map((sec) => (
            <React.Fragment key={sec.id}>
              <tr>
                <td style={{ fontWeight: "bold" }}>{sec.number}. {sec.title}</td>
              </tr>
              {sec.subsections.map((sub) => (
                <tr key={sub.id}>
                  <td style={{ paddingLeft: 24 }}>{sub.number} {sub.title}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </>
  );

  const renderComplianceMatrixContent = () => (
    <>
      <h2 style={{ borderBottom: "none" }}>{numberOf("compliance-matrix")}. Compliance Cross-Reference Matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Solicitation Ref.</th>
            <th>Requirement</th>
            <th>Proposal Section</th>
          </tr>
        </thead>
        <tbody>
          {data.complianceRows.map((row) => (
            <tr key={row.id}>
              <td>{row.solicitationRef}</td>
              <td>{row.requirement}</td>
              <td>{row.sectionId ? findOutlineLabel(outline, row.sectionId) || "—" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  // Deliberately NOT wrapping in break-inside:avoid anymore — that was
  // forcing whole subsection chunks (400-600px each) to jump to a fresh
  // page wholesale whenever they didn't perfectly fit what was left of
  // the current page, which was the actual dominant cause of large gaps
  // in the printed output (confirmed by tracing the real measured
  // heights through the page-fitting math). Content now flows and splits
  // naturally like ordinary paragraphs, relying on the existing
  // `h2, h3 { page-break-after: avoid }` (a heading is never left alone
  // at the bottom of a page) and `p, li { orphans: 3; widows: 3 }` (a
  // paragraph never splits with fewer than 3 lines on either side) for
  // reasonable typographic behavior instead of atomic block movement.
  const keepTogether = (children) => <>{children}</>;

  // Decomposed into three chunks so each subsection gets its own measured
  // position instead of only the section as a whole. Chunk A carries both
  // the "2. Executive Summary" heading and the "2.1" subsection heading —
  // they're rendered with nothing between them, so they're structurally
  // guaranteed to always land on the same page; see the ids: [...] usage
  // in measureOrder below.
  const renderExecSummaryChunkA = () => keepTogether(<>
    <h2>{numberOf("executive-summary")}. Executive Summary</h2>
    <h3>{numberOf("exec-requirement")} Understanding of the Requirement</h3>
    <p>{data.requirementSummary}</p>
  </>);
  const renderExecSummaryChunkB = () => keepTogether(<>
    <h3>{numberOf("exec-winthemes")} Win Themes</h3>
    <ul>{winThemeList.map((t, i) => <li key={i}>{t}</li>)}</ul>
  </>);
  const renderExecSummaryChunkC = () => (
    <>
      {keepTogether(<>
        <h3>{numberOf("exec-snapshot")} Company Snapshot</h3>
        <p>{data.companySnapshot}</p>
      </>)}
      <p><strong>Business Size:</strong> {data.businessSize}</p>
      <p style={{ marginBottom: 0 }}><strong>NAICS:</strong></p>
      {naicsEntries.length > 0 && (
        <ul>{naicsEntries.map(({ code, title }) => <li key={code}>{code} – {title}</li>)}</ul>
      )}
      {data.unverifiedNaicsEntries && data.unverifiedNaicsEntries.length > 0 && (
        <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
          ({data.unverifiedNaicsEntries.length} unverified NAICS {data.unverifiedNaicsEntries.length === 1 ? "entry" : "entries"} not
          shown — reselect in the builder before submitting.)
        </p>
      )}
    </>
  );
  const renderExecutiveSummaryContent = () => (
    <>{renderExecSummaryChunkA()}{renderExecSummaryChunkB()}{renderExecSummaryChunkC()}</>
  );

  const renderProseList = (value) => {
    const items = Array.isArray(value?.items) ? value.items.map((s) => s.trim()).filter(Boolean) : [];
    return (
      <>
        {value?.intro?.trim() && <p>{value.intro.trim()}</p>}
        {items.length > 0 && <ul>{items.map((line, i) => <li key={i}>{line}</li>)}</ul>}
        {value?.closing?.trim() && <p>{value.closing.trim()}</p>}
      </>
    );
  };

  const renderTechApproachChunkA = () => keepTogether(<>
    <h2>{numberOf("technical-approach")}. Technical Approach</h2>
    <h3>{numberOf("tech-methodology")} Proposed Methodology</h3>
    <p>{data.methodology}</p>
  </>);
  const renderTechApproachChunkB = () => keepTogether(<>
    <h3>{numberOf("tech-qc")} Quality Control Plan</h3>
    {renderProseList(data.qualityControl)}
  </>);
  const renderTechApproachChunkC = () => keepTogether(<>
    <h3>{numberOf("tech-risk")} Risk Management</h3>
    {renderProseList(data.riskManagement)}
  </>);
  const renderTechnicalApproachContent = () => (
    <>{renderTechApproachChunkA()}{renderTechApproachChunkB()}{renderTechApproachChunkC()}</>
  );

  const renderKeyPersonnelContent = () => (
    <>
      <h2>{numberOf("key-personnel")}. Key Personnel</h2>
      <table className="personnel-table">
        <colgroup>
          <col className="col-name" /><col className="col-role" /><col className="col-exp" /><col className="col-alloc" />
        </colgroup>
        <thead><tr><th>Name</th><th>Role</th><th>Experience</th><th>% Allocation</th></tr></thead>
        <tbody>
          {data.personnel.map((p, i) => (
            <tr key={i} className="personnel-row"><td>{p.name}</td><td>{p.role}</td><td>{p.experience}</td><td>{p.allocation}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const renderPastPerformanceContent = () => (
    <>
      {data.pastPerformance.map((pp, i) => {
        const block = (
          <div key={i} className="pastperf-block" style={{ marginBottom: 14 }}>
            <table>
              <tbody>
                <tr><td style={{ fontWeight: "bold", width: "30%" }}>Contract #</td><td>{pp.contractNumber}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Agency</td><td>{pp.agency}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Period</td><td>{pp.period}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Value</td><td>{pp.value}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Scope</td><td>{pp.scope}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Relevance to This Requirement</td><td>{pp.relevance}</td></tr>
                {pp.contractType && <tr><td style={{ fontWeight: "bold" }}>Contract Type</td><td>{pp.contractType}</td></tr>}
                {pp.primeOrSub && <tr><td style={{ fontWeight: "bold" }}>Role</td><td>{pp.primeOrSub}</td></tr>}
                <tr><td style={{ fontWeight: "bold" }}>Reference</td><td>{pp.reference}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Reference Email</td><td>{pp.referenceEmail}</td></tr>
                {pp.cpars && <tr><td style={{ fontWeight: "bold" }}>CPARS Rating</td><td>{pp.cpars}</td></tr>}
              </tbody>
            </table>
          </div>
        );
        // Only the FIRST entry is wrapped together with the heading — later
        // entries still break independently, so a long Past Performance
        // list doesn't get forced onto one giant unsplittable block.
        return i === 0 ? (
          <div key="pp-first-with-heading" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            <h2>{numberOf("past-performance")}. Past Performance</h2>
            {block}
          </div>
        ) : block;
      })}
    </>
  );

  // A trailing non-breaking space, appended to every cell except the last
  // in a row. This is the actual fix for the text-layer bug: CSS padding
  // and cell borders are purely visual — they don't put a character in
  // the underlying text content, so a PDF text-extraction pass can read
  // two adjacent cells with zero characters between them and glue them
  // together ("...Set250 SET"). An NBSP is real, non-collapsing text
  // content, so there's always an actual space in the stream at every
  // cell boundary no matter how any given extraction tool's coordinate
  // heuristics behave.
  const sep = (content) => <>{content}{"\u00A0"}</>;

  const renderPriceProposalChunkA = () => (
    <>
      <h2>{numberOf("price-proposal")}. Price Proposal</h2>
      <table>
        <thead>
          <tr>
            <th>CLIN</th><th>Description</th><th>Quantity</th><th>Unit</th><th>Unit Price</th><th>Ext. Price</th>
          </tr>
        </thead>
        <tbody>
          {data.pricing.map((row, i) => (
            <tr key={i}>
              <td>{sep(row.clin)}</td>
              <td>{sep(row.description)}</td>
              <td>{sep(row.quantity)}</td>
              <td>{sep(row.unitOfMeasure)}</td>
              <td>{sep(formatCurrency(row.unitPrice))}</td>
              <td>{formatCurrency(computeExtended(row.quantity, row.unitPrice))}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{ fontWeight: "bold", textAlign: "right" }}>Total Evaluated Price</td>
            <td style={{ fontWeight: "bold" }}>{formatCurrency(totalPrice)}</td>
          </tr>
        </tbody>
      </table>
      {data.fobTerm && <p><strong>{data.fobTerm}</strong></p>}
    </>
  );
  const renderPriceProposalChunkB = () => keepTogether(<>
    <h3>{numberOf("price-boe")} Basis of Estimate</h3>
    <p>{data.basisOfEstimate}</p>
  </>);
  const renderPriceProposalChunkC = () => keepTogether(<>
    <h3>{numberOf("price-assumptions")} Assumptions</h3>
    <ul>
      {data.assumptions.split("\n").map((s) => s.trim()).filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  </>);
  const renderPriceProposalContent = () => (
    <>
      {renderPriceProposalChunkA()}
      {numberOf("price-boe") && renderPriceProposalChunkB()}
      {numberOf("price-assumptions") && renderPriceProposalChunkC()}
    </>
  );

  const renderDeliveryScheduleContent = () => (
    <>
      <h2>{numberOf("delivery-schedule")}. Delivery Schedule</h2>
      <table>
        <thead>
          <tr><th>CLIN</th><th>Destination</th><th>Quantity</th><th>Delivery</th></tr>
        </thead>
        <tbody>
          {data.deliverySchedule.map((row, i) => (
            <tr key={i}>
              <td>{row.clin}</td>
              <td>{row.destination}</td>
              <td>{row.quantity}</td>
              <td>
                {row.daysAfterReceipt
                  ? `${row.daysAfterReceipt} days after receipt of order`
                  : (row.deliveryDate || "")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const renderWarrantyContent = () => (
    <>
      <h2>{numberOf("warranty")}. Warranty</h2>
      {data.warrantyPeriod && <p><strong>Warranty Period:</strong> {data.warrantyPeriod}</p>}
      {data.warrantyTerms && <p>{data.warrantyTerms}</p>}
    </>
  );

  const renderRepsCertsContent = () => (
    <>
      <h2>{numberOf("reps-certs")}. Representations and Certifications</h2>
      <ul>
        {data.samRegistrationActive && (
          <li>
            SAM registration: Active
            {data.uei && ` (UEI: ${data.uei})`}
            {data.samExpirationDate && `, expires ${data.samExpirationDate}`}
          </li>
        )}
        {data.businessSize && data.businessSize.trim() && (
          <li>Business size: {data.businessSize.trim()}</li>
        )}
        {data.setAsideCategories.map((cat) => (
          <li key={cat}>Socioeconomic set-aside claimed: {cat}</li>
        ))}
      </ul>
    </>
  );

  return (
    <div style={{ background: "#f0f0ee", minHeight: "100vh" }}>
      <style>{`
        /* ── Screen-only chrome ── */
        @media print {
          body { background: #fff !important; }
        }

        /*
          ── Running footer: solicitation number left, page X of Y right ──
          This is written per the CSS Paged Media spec (@page margin boxes).
          Real support caveat: Chrome/Chromium has partial, evolving support
          for this; Firefox and Safari largely don't render it. Where it
          isn't supported, it silently does nothing (no error) — the
          document.title trick above is the practical fallback via the
          browser's own native print header/footer, which most people leave
          switched on by default.
        */
        @page {
          size: letter;
          margin: 1in;
        }
        @page {
          @bottom-left  { content: "Solicitation No. ${data.solicitationNumber || "—"}"; font-family: 'Space Grotesk', sans-serif; font-size: 9pt; color: #333; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); font-family: 'Space Grotesk', sans-serif; font-size: 9pt; color: #333; }
        }

        /* ── Two font families max: serif body (already set inline), sans headings ── */
        .doc-page h2, .doc-page h3 { font-family: 'Space Grotesk', sans-serif; }
        .doc-page h2 { color: ${NAVY}; border-bottom: 2px solid ${NAVY}; padding-bottom: 6px; font-size: 18px; margin-top: 0; }
        .doc-page h3 { color: ${NAVY}; font-size: 15px; margin-bottom: 4px; }

        /* ── Pagination ──
           Only these force a fresh page: Cover Letter (the ".doc-section-break"
           class), the Table of Contents, the Compliance Matrix, and the Price
           Proposal. Executive Summary, Technical Approach, Key Personnel, and
           Past Performance flow continuously — forcing every section onto its
           own page was wasting roughly half the document on blank space,
           which is a real liability against a solicitation's page limit. */
        @media print {
          .doc-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
          .doc-section-break { page-break-before: always; break-before: page; }
          /* Tables are now allowed to split across a page boundary — a
             table with more rows than fit in the remaining space on the
             current page continues on the next, rather than the whole
             table jumping wholesale to a fresh page and leaving whatever
             was left of the current one blank. Only individual rows
             (and the personnel/past-performance row-groups below) are
             still protected from being cut in half. thead repeating
             ensures a split table's continuation still shows column
             labels instead of an unlabeled row of data. */
          .doc-page table thead { display: table-header-group; }
          .doc-page table tr { page-break-inside: avoid; break-inside: avoid; }
          .personnel-row, .pastperf-block { page-break-inside: avoid; break-inside: avoid; }
          .doc-page p, .doc-page li { orphans: 3; widows: 3; }
          .doc-page h2, .doc-page h3 { page-break-after: avoid; break-after: avoid; }
          .doc-letterhead {
            min-height: 9in;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
        }

        .doc-page table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .doc-page th { background: ${NAVY}; color: #fff; text-align: left; padding: 6px 8px; font-size: 12px; }
        .doc-page td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
        .doc-page tr:nth-child(even) td { background: #f7f7f5; }

        .doc-page p { margin: 0 0 12pt 0; }
        .doc-page ul { margin: 0 0 12pt 0; padding-left: 20px; }
        .doc-page li { margin-bottom: 4pt; }

        .cover-signoff { margin-bottom: 4pt !important; }
        .cover-signature { margin-top: 4pt !important; line-height: 1.4; }
        .signature-rule { border-top: 1px solid #333; width: 3in; margin-top: 2pt; }
        .enclosures-line { margin-top: 8pt; font-size: 0.9em; }
        /* Cover-letter-only paragraph spacing — deliberately scoped here,
           not applied to .doc-page p globally, so no other section's
           layout shifts. Slightly tighter than the document-wide default
           to keep the cover letter compact. */
        .cover-letter-section p { margin-bottom: 8pt; }

        .personnel-table col.col-name { width: 22%; }
        .personnel-table col.col-role { width: 24%; }
        .personnel-table col.col-exp  { width: 42%; }
        .personnel-table col.col-alloc { width: 12%; }
      `}</style>

      <div className="no-print" style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #ddd", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10 }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onBack} style={{ ...addBtnStyle, borderColor: "#999", color: "#333" }}>← Back to Edit</button>
          <button
            onClick={() => window.print()}
            style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 4, padding: "8px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            Print / Save as PDF
          </button>
          <button
            onClick={handleDownloadDocx}
            disabled={docxGenerating}
            style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 4, padding: "8px 20px", fontWeight: 600, cursor: docxGenerating ? "wait" : "pointer" }}
          >
            {docxGenerating ? "Generating…" : "Download Word Doc"}
          </button>
        </div>
        {docxError && <p style={{ color: "#c44", fontSize: 12, margin: 0 }}>{docxError}</p>}
      </div>

      <div className="doc-page" style={{ maxWidth: 800, margin: "24px auto", background: PAPER, padding: "48px 56px", boxShadow: "0 2px 20px rgba(0,0,0,0.1)", fontFamily: "Georgia, serif", color: "#222", lineHeight: 1.5 }}>
        <div className="doc-letterhead">{renderLetterheadContent()}</div>
        <div className="doc-section doc-section-break cover-letter-section">{renderCoverLetterContent()}</div>
        <div className="doc-section doc-section-break">{renderTOCContent()}</div>
        {hasMatrix && <div className="doc-section doc-section-break">{renderComplianceMatrixContent()}</div>}
        <div className="doc-section">{renderExecutiveSummaryContent()}</div>
        <div className="doc-section">{renderTechnicalApproachContent()}</div>
        <div className="doc-section">{renderKeyPersonnelContent()}</div>
        <div className="doc-section">{renderPastPerformanceContent()}</div>
        <div className="doc-section doc-section-break">{renderPriceProposalContent()}</div>
        {hasDeliverySchedule && <div className="doc-section">{renderDeliveryScheduleContent()}</div>}
        {hasWarranty && <div className="doc-section">{renderWarrantyContent()}</div>}
        {hasRepsCerts && <div className="doc-section">{renderRepsCertsContent()}</div>}
      </div>
    </div>
  );
}
