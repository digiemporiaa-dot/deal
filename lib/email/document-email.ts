import "server-only";
import type { Totals } from "@/lib/documents";

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(n: number, currency: string): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function day(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function documentEmail(d: {
  siteName: string;
  kindLabel: string;
  number: string;
  customerName: string;
  title?: string | null;
  items: { title: string; quantity: number; unitPrice: number }[];
  totals: Totals;
  currency: string;
  validUntil?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  terms?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  viewUrl?: string | null;
}): string {
  const rows = d.items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px">${esc(i.title)}<br>
          <span style="color:#94a3b8;font-size:12px">${i.quantity} × ${money(i.unitPrice, d.currency)}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600">
          ${money(i.quantity * i.unitPrice, d.currency)}</td>
      </tr>`,
    )
    .join("");

  const totalRow = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;font-size:13px;color:${bold ? "#0f172a" : "#64748b"};${bold ? "font-weight:700" : ""}">${esc(label)}</td>
     <td style="padding:4px 0;font-size:${bold ? "16px" : "13px"};text-align:right;${bold ? "font-weight:700;color:#0f172a" : ""}">${value}</td></tr>`;

  const t = d.totals;
  const totalsHtml = [
    totalRow("Subtotal", money(t.subtotal, d.currency)),
    t.discount > 0 ? totalRow("Discount", `− ${money(t.discount, d.currency)}`) : "",
    t.taxAmount > 0 ? totalRow(`Tax (${t.taxPercent}%)`, money(t.taxAmount, d.currency)) : "",
    totalRow("Total", money(t.total, d.currency), true),
    t.amountPaid > 0 ? totalRow("Paid", `− ${money(t.amountPaid, d.currency)}`) : "",
    t.amountPaid > 0 ? totalRow("Balance due", money(t.balance, d.currency), true) : "",
  ].join("");

  const dateLine = d.validUntil
    ? `<p style="margin:0 0 16px;font-size:13px;color:#64748b">Valid until <strong>${day(d.validUntil)}</strong></p>`
    : d.dueDate
      ? `<p style="margin:0 0 16px;font-size:13px;color:#64748b">Payment due by <strong>${day(d.dueDate)}</strong></p>`
      : "";

  const contact = [d.phone ? `Call ${esc(d.phone)}` : "", d.whatsapp ? `WhatsApp ${esc(d.whatsapp)}` : ""]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f6f8;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#1b70f1;border-radius:12px 12px 0 0;padding:22px 28px">
      <span style="color:#fff;font-size:19px;font-weight:700">${esc(d.siteName)}</span>
      <span style="float:right;color:#dbeafe;font-size:13px">${esc(d.kindLabel)} ${esc(d.number)}</span>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e5e7eb;border-top:none">
      <p style="margin:0 0 6px;font-size:14px;line-height:1.6">Hi ${esc(d.customerName)},</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6">
        Please find your ${esc(d.kindLabel.toLowerCase())} below${d.title ? ` for <strong>${esc(d.title)}</strong>` : ""}.
      </p>
      ${dateLine}
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px">${rows}</table>
      <table style="width:100%;border-collapse:collapse;border-top:2px solid #e2e8f0;padding-top:8px">${totalsHtml}</table>
      ${d.notes ? `<div style="margin-top:18px;background:#f8fafc;border-radius:8px;padding:12px;font-size:13px;line-height:1.6">${esc(d.notes).replace(/\n/g, "<br>")}</div>` : ""}
      ${d.terms ? `<p style="margin-top:14px;font-size:12px;color:#94a3b8;line-height:1.6">${esc(d.terms).replace(/\n/g, "<br>")}</p>` : ""}
      <p style="margin:22px 0 0;font-size:14px;line-height:1.6">Warm regards,<br><strong>${esc(d.siteName)}</strong></p>
      ${contact ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280">${contact}</p>` : ""}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:14px">© ${new Date().getFullYear()} ${esc(d.siteName)}</p>
  </div>
</body></html>`;
}
