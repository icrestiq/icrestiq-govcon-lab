import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { isPaidMember } from "../lib/tier";

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
 *   2. Storage bucket `proposal-logos` (public read, user-scoped write)
 */

const NAVY = "#1F3864";
const GOLD = "#B08D57";
const PAPER = "#FDFCFA";

const MAX_LOGO_MB = 2;
const MAX_LOGO_BYTES = MAX_LOGO_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_LABEL = "PNG, JPG, or WEBP";

const emptyPersonnel = () => ({ name: "", role: "", experience: "", allocation: "" });
const emptyClin = () => ({ clin: "", description: "", qty: "", unitPrice: "", extPrice: "" });
const emptyPastPerf = () => ({
  contractNumber: "", agency: "", period: "", value: "", scope: "", reference: "",
});

const initialState = {
  companyName: "",
  companyAddress: "",
  uei: "",
  cageCode: "",
  solicitationNumber: "",
  solicitationTitle: "",
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
  qualityControl: "",
  riskManagement: "",
  personnel: [emptyPersonnel()],
  pastPerformance: [emptyPastPerf()],
  pricing: [emptyClin()],
  basisOfEstimate: "",
  businessSize: "",
  naics: "",
};

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
  const [data, setData] = useState(initialState);
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
        setData({ ...initialState, ...draft.data });
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

  const totalPrice = data.pricing.reduce((sum, row) => {
    const n = parseFloat(row.extPrice);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

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
          <div style={{ fontSize: 12, color: saveStatus === "error" ? "#c44" : "#888" }}>
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Draft saved"}
            {saveStatus === "error" && "Couldn't save draft"}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Business Size / Set-Aside Status"><input style={inputStyle} placeholder="e.g. Small Business, SDVOSB" value={data.businessSize} onChange={set("businessSize")} /></Field>
          <Field label="NAICS Code(s)"><input style={inputStyle} value={data.naics} onChange={set("naics")} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Solicitation & Submission">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Solicitation Number"><input style={inputStyle} value={data.solicitationNumber} onChange={set("solicitationNumber")} /></Field>
          <Field label="Submission Date"><input style={inputStyle} type="date" value={data.submissionDate} onChange={set("submissionDate")} /></Field>
        </div>
        <Field label="Solicitation Title"><input style={inputStyle} value={data.solicitationTitle} onChange={set("solicitationTitle")} /></Field>
        <Field label="Contracting Agency"><input style={inputStyle} value={data.agencyName} onChange={set("agencyName")} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Contracting Officer"><input style={inputStyle} value={data.contractingOfficer} onChange={set("contractingOfficer")} /></Field>
          <Field label="Agency Address"><input style={inputStyle} value={data.agencyAddress} onChange={set("agencyAddress")} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Your POC Name / Title"><input style={inputStyle} value={data.poc} onChange={set("poc")} /></Field>
          <Field label="Phone"><input style={inputStyle} value={data.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><input style={inputStyle} value={data.email} onChange={set("email")} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Executive Summary">
        <Field label="Understanding of the Requirement"><textarea style={textareaStyle} value={data.requirementSummary} onChange={set("requirementSummary")} /></Field>
        <Field label="Win Themes (one per line)"><textarea style={textareaStyle} value={data.winThemes} onChange={set("winThemes")} /></Field>
        <Field label="Company Snapshot"><textarea style={textareaStyle} value={data.companySnapshot} onChange={set("companySnapshot")} /></Field>
      </SectionCard>

      <SectionCard title="Technical Approach">
        <Field label="Proposed Methodology"><textarea style={textareaStyle} value={data.methodology} onChange={set("methodology")} /></Field>
        <Field label="Quality Control Plan"><textarea style={textareaStyle} value={data.qualityControl} onChange={set("qualityControl")} /></Field>
        <Field label="Risk Management"><textarea style={textareaStyle} value={data.riskManagement} onChange={set("riskManagement")} /></Field>
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
            <Field label="Scope / Relevance"><textarea style={textareaStyle} value={pp.scope} onChange={(e) => updateList("pastPerformance", i, "scope", e.target.value)} /></Field>
            <Field label="Reference Contact"><input style={inputStyle} value={pp.reference} onChange={(e) => updateList("pastPerformance", i, "reference", e.target.value)} /></Field>
            {data.pastPerformance.length > 1 && (
              <button onClick={() => removeRow("pastPerformance", i)} style={removeBtnStyle}>Remove</button>
            )}
          </div>
        ))}
        <button onClick={() => addRow("pastPerformance", emptyPastPerf)} style={addBtnStyle}>+ Add Contract Reference</button>
      </SectionCard>

      <SectionCard title="Price Proposal">
        {data.pricing.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "0.8fr 2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <Field label="CLIN"><input style={inputStyle} value={row.clin} onChange={(e) => updateList("pricing", i, "clin", e.target.value)} /></Field>
            <Field label="Description"><input style={inputStyle} value={row.description} onChange={(e) => updateList("pricing", i, "description", e.target.value)} /></Field>
            <Field label="Qty/Hrs"><input style={inputStyle} value={row.qty} onChange={(e) => updateList("pricing", i, "qty", e.target.value)} /></Field>
            <Field label="Unit Price"><input style={inputStyle} value={row.unitPrice} onChange={(e) => updateList("pricing", i, "unitPrice", e.target.value)} /></Field>
            <Field label="Ext. Price"><input style={inputStyle} value={row.extPrice} onChange={(e) => updateList("pricing", i, "extPrice", e.target.value)} /></Field>
            {data.pricing.length > 1 && (
              <button onClick={() => removeRow("pricing", i)} style={removeBtnStyle}>Remove</button>
            )}
          </div>
        ))}
        <button onClick={() => addRow("pricing", emptyClin)} style={addBtnStyle}>+ Add Line Item</button>
        <div style={{ marginTop: 12, fontWeight: 600, color: NAVY }}>Total: ${totalPrice.toLocaleString()}</div>
        <Field label="Basis of Estimate"><textarea style={textareaStyle} value={data.basisOfEstimate} onChange={set("basisOfEstimate")} /></Field>
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
  const winThemeList = data.winThemes.split("\n").filter(Boolean);

  return (
    <div style={{ background: "#f0f0ee", minHeight: "100vh" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .doc-page { box-shadow: none !important; margin: 0 !important; }
          body { background: #fff !important; }
        }
        .doc-page h2 { color: ${NAVY}; border-bottom: 2px solid ${NAVY}; padding-bottom: 6px; font-size: 18px; }
        .doc-page h3 { color: ${NAVY}; font-size: 15px; margin-bottom: 4px; }
        .doc-page table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .doc-page th { background: ${NAVY}; color: #fff; text-align: left; padding: 6px 8px; font-size: 12px; }
        .doc-page td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
        .doc-page tr:nth-child(even) td { background: #f7f7f5; }
      `}</style>

      <div className="no-print" style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #ddd", padding: 12, display: "flex", gap: 10, justifyContent: "center", zIndex: 10 }}>
        <button onClick={onBack} style={{ ...addBtnStyle, borderColor: "#999", color: "#333" }}>← Back to Edit</button>
        <button
          onClick={() => window.print()}
          style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 4, padding: "8px 20px", fontWeight: 600, cursor: "pointer" }}
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="doc-page" style={{ maxWidth: 800, margin: "24px auto", background: PAPER, padding: "48px 56px", boxShadow: "0 2px 20px rgba(0,0,0,0.1)", fontFamily: "Georgia, serif", color: "#222", lineHeight: 1.5 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {logoUrl && (
            <img src={logoUrl} alt="Company logo" style={{ maxHeight: 80, maxWidth: 240, objectFit: "contain", marginBottom: 12 }} />
          )}
          <div style={{ fontWeight: "bold", fontSize: 22, color: NAVY }}>{data.companyName || "[Company Name]"}</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {data.companyAddress} {data.uei && `| UEI: ${data.uei}`} {data.cageCode && `| CAGE: ${data.cageCode}`}
          </div>
          <div style={{ borderTop: `2px solid ${GOLD}`, borderBottom: `2px solid ${GOLD}`, margin: "16px 0", padding: "10px 0" }}>
            <div style={{ fontSize: 26, fontWeight: "bold", color: NAVY }}>TECHNICAL &amp; PRICE PROPOSAL</div>
          </div>
          <div>In Response to Solicitation No. {data.solicitationNumber || "[Number]"}</div>
          <div style={{ fontStyle: "italic", color: "#555" }}>{data.solicitationTitle}</div>
        </div>

        <h2>1. Cover Letter</h2>
        <p>{data.submissionDate}</p>
        <p>{data.contractingOfficer}<br />{data.agencyName}<br />{data.agencyAddress}</p>
        <p>Subject: Proposal Submission for Solicitation No. {data.solicitationNumber} – {data.solicitationTitle}</p>
        <p>Dear {data.contractingOfficer || "Contracting Officer"},</p>
        <p>{data.companyName} is pleased to submit the enclosed proposal in response to the above-referenced solicitation. We have reviewed the solicitation in its entirety and our proposal is fully compliant with the stated requirements, terms, and conditions.</p>
        <p>Sincerely,<br />{data.poc}<br />{data.pocTitle}<br />{data.phone} | {data.email}</p>

        <h2>2. Executive Summary</h2>
        <h3>2.1 Understanding of the Requirement</h3>
        <p>{data.requirementSummary}</p>
        <h3>2.2 Win Themes</h3>
        <ul>{winThemeList.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <h3>2.3 Company Snapshot</h3>
        <p>{data.companySnapshot}</p>
        <p><strong>Business Size:</strong> {data.businessSize} &nbsp; <strong>NAICS:</strong> {data.naics}</p>

        <h2>3. Technical Approach</h2>
        <h3>3.1 Proposed Methodology</h3>
        <p>{data.methodology}</p>
        <h3>3.2 Quality Control Plan</h3>
        <p>{data.qualityControl}</p>
        <h3>3.3 Risk Management</h3>
        <p>{data.riskManagement}</p>

        <h2>4. Key Personnel</h2>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Experience</th><th>% Allocation</th></tr></thead>
          <tbody>
            {data.personnel.map((p, i) => (
              <tr key={i}><td>{p.name}</td><td>{p.role}</td><td>{p.experience}</td><td>{p.allocation}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>5. Past Performance</h2>
        {data.pastPerformance.map((pp, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <table>
              <tbody>
                <tr><td style={{ fontWeight: "bold", width: "30%" }}>Contract #</td><td>{pp.contractNumber}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Agency</td><td>{pp.agency}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Period</td><td>{pp.period}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Value</td><td>{pp.value}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Scope</td><td>{pp.scope}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Reference</td><td>{pp.reference}</td></tr>
              </tbody>
            </table>
          </div>
        ))}

        <h2>6. Price Proposal</h2>
        <table>
          <thead><tr><th>CLIN</th><th>Description</th><th>Qty/Hrs</th><th>Unit Price</th><th>Ext. Price</th></tr></thead>
          <tbody>
            {data.pricing.map((row, i) => (
              <tr key={i}><td>{row.clin}</td><td>{row.description}</td><td>{row.qty}</td><td>{row.unitPrice}</td><td>{row.extPrice}</td></tr>
            ))}
            <tr><td colSpan={4} style={{ fontWeight: "bold", textAlign: "right" }}>TOTAL</td><td style={{ fontWeight: "bold" }}>${totalPrice.toLocaleString()}</td></tr>
          </tbody>
        </table>
        <h3>6.1 Basis of Estimate</h3>
        <p>{data.basisOfEstimate}</p>
      </div>
    </div>
  );
}
