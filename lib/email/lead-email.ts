import "server-only";

/** Escape user-typed text so it is safe inside HTML email. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type LeadReplyEmailData = {
  siteName: string;
  leadName: string;
  message: string;
  senderName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  siteUrl?: string | null;
};

/**
 * Branded HTML email sent manually from the admin panel to a lead.
 * The body is plain text typed by the team member; newlines become <br>.
 */
export function leadReplyEmail(d: LeadReplyEmailData): string {
  const bodyHtml = esc(d.message).replace(/\n/g, "<br>");
  const signer = d.senderName ? esc(d.senderName) : "Team";
  const contactBits: string[] = [];
  if (d.phone) contactBits.push(`Call: ${esc(d.phone)}`);
  if (d.whatsapp) contactBits.push(`WhatsApp: ${esc(d.whatsapp)}`);
  const contactLine = contactBits.length
    ? `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">${contactBits.join(" &nbsp;·&nbsp; ")}</p>`
    : "";
  const siteLine = d.siteUrl
    ? `<p style="margin:6px 0 0;font-size:13px"><a href="${esc(d.siteUrl)}" style="color:#1b70f1">${esc(d.siteUrl)}</a></p>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f6f8;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#1b70f1;border-radius:12px 12px 0 0;padding:20px 28px">
      <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-.5px">${esc(d.siteName)}</span>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e5e7eb;border-top:none">
      <p style="margin:0 0 12px;line-height:1.6;font-size:14px">Hi ${esc(d.leadName)},</p>
      <div style="line-height:1.6;font-size:14px">${bodyHtml}</div>
      <p style="margin:20px 0 0;line-height:1.6;font-size:14px">Warm regards,<br><strong>${signer}</strong><br>${esc(d.siteName)}</p>
      ${contactLine}
      ${siteLine}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
      © ${new Date().getFullYear()} ${esc(d.siteName)}
    </p>
  </div>
</body></html>`;
}
