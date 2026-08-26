import React, { useMemo } from "react";
import { C } from "./shared.jsx";

const GST_RATE = 18;
const fmt = n => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmt2 = n => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const PAYMENT_STAGES = [
  { pct: 20, label: "Advance Payment", desc: "Booking & Material" },
  { pct: 50, label: "Interim Payment", desc: "Surface Prep & Primer Complete" },
  { pct: 30, label: "Final Payment", desc: "Project Handover" },
];

export default function InvoiceModal({ project, totals, onClose }) {
  const data = useMemo(() => {
    const grandTotal = totals?.grandTotal || 0;
    const grandArea = totals?.grandArea || 0;
    const subtotal = totals?.combinedSubtotal || 0;
    const additionalCharges = totals?.additionalCharges || 0;
    const discountAmount = totals?.discountAmount || 0;
    const taxableAmount = totals?.taxableAmount || 0;
    const gstAmount = totals?.gstAmount || 0;
    const gstPct = totals?.gstPct || 0;
    const hasGst = gstAmount > 0;

    const matTotal =
      (totals?.interior ? 0 : 0) +
      (Number(totals?.exterior?.material) || 0);
    const labTotal = Number(totals?.exterior?.labour) || 0;

    const invoiceNo = `INV-${String(project?.id || "").slice(-6).toUpperCase()}`;
    const date = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const stages = PAYMENT_STAGES.map(s => ({
      ...s,
      amount: (grandTotal * s.pct) / 100,
    }));

    const amountPaid = stages[0].amount; // advance assumed paid
    const balanceDue = grandTotal - amountPaid;

    const sections = [
      { label: "Interior", area: totals?.interior?.area || 0, total: totals?.interior?.total || 0, material: 0, labour: 0 },
      { label: "Exterior", area: totals?.exterior?.area || 0, total: totals?.exterior?.total || 0, material: totals?.exterior?.material || 0, labour: totals?.exterior?.labour || 0 },
      { label: "Polish / Enamel", area: totals?.polish?.area || 0, total: totals?.polish?.total || 0, material: 0, labour: 0 },
      { label: "Door & Window", area: totals?.doorwindow?.area || 0, total: totals?.doorwindow?.total || 0, material: 0, labour: 0 },
      { label: "Wallpaper", area: totals?.wallpaper?.area || 0, total: totals?.wallpaper?.total || 0, material: 0, labour: 0 },
      { label: "Texture", area: totals?.texture?.area || 0, total: totals?.texture?.total || 0, material: 0, labour: 0 },
    ].filter(s => s.total > 0 || s.area > 0);

    return {
      grandTotal, grandArea, subtotal, additionalCharges, discountAmount,
      taxableAmount, gstAmount, gstPct, hasGst, matTotal, labTotal,
      invoiceNo, date, stages, amountPaid, balanceDue, sections,
    };
  }, [project, totals]);

  const cust = project?.customer || {};
  const scope = project?.scope || "—";
  const projectType = project?.projectType === "fresh" ? "Fresh Painting" : project?.projectType === "repaint" ? "Re-Painting" : "—";
  const category = project?.projectCategory || project?.category || "—";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "16px 12px" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 14, maxWidth: 720, width: "100%", margin: "0 auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
      >
        {/* Modal header bar (screen only) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }} className="no-print">
          <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>Invoice & Payment Schedule</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#bbb", cursor: "pointer" }}>✕</button>
        </div>

        {/* Printable invoice body */}
        <div id="invoice-print-area" style={{ padding: "28px 32px", color: "#1a1a1a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${C.navy}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/Paintship W-Logo.png" alt="PaintShip" style={{ height: 56, width: "auto" }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.navy, letterSpacing: "0.02em" }}>PaintShip</div>
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>Professional Painting & Surface Finishing</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.orange }}>INVOICE</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>No: <b>{data.invoiceNo}</b></div>
              <div style={{ fontSize: 11, color: "#555" }}>Date: <b>{data.date}</b></div>
            </div>
          </div>

          {/* Client info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.gray, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Billed To</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{cust.name || "—"}</div>
              {cust.address && <div style={{ fontSize: 11, color: "#555", marginTop: 3, lineHeight: 1.5 }}>{cust.address}</div>}
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                {cust.location && <span>{cust.location}</span>}
                {cust.pincode && <span> — {cust.pincode}</span>}
              </div>
              {cust.mobile && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Mob: {cust.mobile}</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.gray, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Project Details</div>
              <div style={{ fontSize: 11, color: "#555", lineHeight: 1.8 }}>
                <div><span style={{ color: C.gray }}>Category:</span> <b>{category}</b></div>
                <div><span style={{ color: C.gray }}>Type:</span> <b>{projectType}</b></div>
                <div><span style={{ color: C.gray }}>Scope:</span> <b style={{ textTransform: "capitalize" }}>{scope}</b></div>
                <div><span style={{ color: C.gray }}>Total Area:</span> <b>{fmt2(data.grandArea)} sq ft</b></div>
              </div>
            </div>
          </div>

          {/* Cost breakdown table */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Cost Breakdown</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.navy, color: "#fff" }}>
                  {["Section", "Area (sq ft)", "Subtotal (₹)"].map(h => (
                    <th key={h} style={{ textAlign: h === "Section" ? "left" : "right", padding: "9px 12px", fontSize: 11, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sections.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 14, textAlign: "center", color: C.gray, fontSize: 12 }}>No scope data yet.</td></tr>
                )}
                {data.sections.map((s, i) => (
                  <tr key={s.label} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? "#FAFAFA" : "#fff" }}>
                    <td style={{ padding: "9px 12px", fontWeight: 600, color: C.navy }}>{s.label}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#555" }}>{fmt2(s.area)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: C.navy }}>₹{fmt(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary charges */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
            <div style={{ width: 280, fontSize: 12 }}>
              <Row label="Subtotal" value={`₹${fmt(data.subtotal)}`} />
              {data.additionalCharges > 0 && <Row label="Additional Charges" value={`₹${fmt(data.additionalCharges)}`} />}
              {data.discountAmount > 0 && <Row label={`Discount`} value={`−₹${fmt(data.discountAmount)}`} color={C.red} />}
              <Row label="Taxable Amount" value={`₹${fmt(data.taxableAmount)}`} bold border />
              {data.hasGst && <Row label={`GST (${data.gstPct || GST_RATE}%)`} value={`₹${fmt(data.gstAmount)}`} />}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", marginTop: 6, borderTop: `2px solid ${C.navy}` }}>
                <span style={{ fontWeight: 900, color: C.navy, fontSize: 14 }}>Project Total</span>
                <span style={{ fontWeight: 900, color: C.orange, fontSize: 16 }}>₹{fmt(data.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment schedule */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>Staged Payment Schedule</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F0F4F8", color: C.navy }}>
                  {["Stage", "Description", "%", "Amount (₹)"].map(h => (
                    <th key={h} style={{ textAlign: h === "Stage" || h === "Description" ? "left" : "right", padding: "9px 12px", fontSize: 11, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.stages.map((s, i) => (
                  <tr key={s.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: C.navy }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: C.orange, color: "#fff", fontSize: 10, fontWeight: 800, marginRight: 8 }}>{i + 1}</span>
                      {s.label}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#555" }}>{s.desc}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: C.gray }}>{s.pct}%</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: C.navy }}>₹{fmt(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Balance summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
            <SummaryBox label="Total Project Value" value={`₹${fmt(data.grandTotal)}`} color={C.navy} />
            <SummaryBox label="Amount Paid (Advance)" value={`₹${fmt(data.amountPaid)}`} color={C.teal} />
            <SummaryBox label="Balance Due" value={`₹${fmt(data.balanceDue)}`} color={C.orange} highlight />
          </div>

          {/* Terms footer */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, fontSize: 10, color: C.gray, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4, fontSize: 11 }}>Terms & Conditions</div>
            Payment due as per the staged schedule above. Work commences upon receipt of advance payment.
            Any additional scope will be billed separately. This is a computer-generated invoice and does not require a signature.
          </div>
        </div>

        {/* Footer actions (screen only) */}
        <div className="no-print" style={{ padding: "14px 18px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "11px 20px", background: "#F0F4F8", color: C.navy, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Close</button>
          <button
            onClick={() => window.print()}
            style={{ padding: "11px 22px", background: C.navy, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            🖨 Print / Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, border, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: border ? "8px 0" : "4px 0", borderTop: border ? `1px solid ${C.border}` : "none" }}>
      <span style={{ color: color || C.gray, fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ color: color || C.navy, fontWeight: bold ? 800 : 600 }}>{value}</span>
    </div>
  );
}

function SummaryBox({ label, value, color, highlight }) {
  return (
    <div style={{
      background: highlight ? C.orangeL : "#F8FAFC",
      border: `1.5px solid ${highlight ? C.orange : C.border}`,
      borderRadius: 10, padding: "12px 10px", textAlign: "center",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}
