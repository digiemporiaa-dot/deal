import "server-only";

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shell(title: string, body: string, siteName = "Vacationdeal"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f6f8;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#1b70f1;border-radius:12px 12px 0 0;padding:18px 28px">
      <span style="color:#fff;font-size:18px;font-weight:700">${esc(siteName)}</span>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:26px;border:1px solid #e5e7eb;border-top:none">
      <h1 style="margin:0 0 14px;font-size:19px;color:#0f172a">${esc(title)}</h1>
      ${body}
    </div>
  </div>
</body></html>`;
}

/** Sent to a team member when a lead is assigned to them. */
export function leadAssignedEmail(d: {
  siteName: string;
  staffName: string;
  leadName: string;
  phone: string;
  email: string | null;
  destination: string | null;
  budget: string | null;
  message: string | null;
  assignedBy: string;
  leadUrl: string;
}): string {
  const rows = [
    ["Name", d.leadName],
    ["Phone", d.phone],
    ["Email", d.email || "—"],
    ["Destination", d.destination || "—"],
    ["Budget", d.budget || "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">${esc(k)}</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right">${esc(v)}</td></tr>`,
    )
    .join("");

  return shell(
    `New lead assigned to you`,
    `<p style="margin:0 0 14px;font-size:14px;line-height:1.6">Hi ${esc(d.staffName)}, ${esc(d.assignedBy)} has assigned a new enquiry to you.</p>
     <table style="width:100%;border-collapse:collapse;margin:0 0 14px">${rows}</table>
     ${d.message ? `<div style="background:#f8fafc;border-radius:8px;padding:12px;font-size:13px;line-height:1.6;margin-bottom:16px">${esc(d.message)}</div>` : ""}
     <a href="${esc(d.leadUrl)}" style="display:inline-block;background:#1b70f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">Open this lead</a>
     <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Contact the customer as soon as possible — fast replies win bookings.</p>`,
    d.siteName,
  );
}

/** Daily digest reminding a team member which of their leads are due. */
export function followUpDigestEmail(d: {
  siteName: string;
  staffName: string;
  overdue: { name: string; destination: string | null; due: string; url: string }[];
  today: { name: string; destination: string | null; due: string; url: string }[];
}): string {
  const list = (items: typeof d.overdue, colour: string) =>
    items
      .map(
        (i) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">
             <a href="${esc(i.url)}" style="color:#1b70f1;font-weight:600;text-decoration:none;font-size:14px">${esc(i.name)}</a>
             <span style="color:#6b7280;font-size:12px"> · ${esc(i.destination || "No destination")}</span><br>
             <span style="color:${colour};font-size:12px">Due ${esc(i.due)}</span>
           </td></tr>`,
      )
      .join("");

  const sections = [
    d.overdue.length
      ? `<h2 style="margin:18px 0 6px;font-size:14px;color:#b91c1c">Overdue (${d.overdue.length})</h2><table style="width:100%;border-collapse:collapse">${list(d.overdue, "#b91c1c")}</table>`
      : "",
    d.today.length
      ? `<h2 style="margin:18px 0 6px;font-size:14px;color:#0f172a">Due today (${d.today.length})</h2><table style="width:100%;border-collapse:collapse">${list(d.today, "#475569")}</table>`
      : "",
  ].join("");

  return shell(
    "Your follow-ups for today",
    `<p style="margin:0;font-size:14px;line-height:1.6">Hi ${esc(d.staffName)}, here is your follow-up list.</p>${sections}`,
    d.siteName,
  );
}

/** The three automatic nurture emails sent to a lead that nobody has replied to. */
export const SEQUENCE_STEPS: { stage: number; afterHours: number; subject: string; intro: string; body: string }[] = [
  {
    stage: 1,
    afterHours: 1,
    subject: "Thanks for your enquiry — we're on it",
    intro: "Thank you for getting in touch about your trip.",
    body: "One of our travel experts is reviewing your requirements right now and will call you shortly with a few tailored options.\n\nIf you'd like to share anything else — preferred hotels, must-visit places, or flexibility on dates — simply reply to this email.",
  },
  {
    stage: 2,
    afterHours: 48,
    subject: "A few ideas for your trip",
    intro: "We wanted to check in on your travel plans.",
    body: "Our team can put together a complete package for you — stays, transfers, sightseeing and support throughout the trip.\n\nWould a quick 5-minute call help? Just reply with a convenient time and we will call you.",
  },
  {
    stage: 3,
    afterHours: 120,
    subject: "Still planning your holiday?",
    intro: "Just a gentle final note from our side.",
    body: "If your plans are still taking shape, we're happy to hold ideas ready for whenever you decide — no pressure at all.\n\nAnd if the timing isn't right, simply ignore this email. We'd love to help whenever you're ready to travel.",
  },
];

export function sequenceEmail(d: {
  siteName: string;
  leadName: string;
  stage: number;
  phone: string | null;
  whatsapp: string | null;
}): string {
  const step = SEQUENCE_STEPS.find((s) => s.stage === d.stage) ?? SEQUENCE_STEPS[0];
  const contact = [d.phone ? `Call ${esc(d.phone)}` : "", d.whatsapp ? `WhatsApp ${esc(d.whatsapp)}` : ""]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return shell(
    step.subject,
    `<p style="margin:0 0 12px;font-size:14px;line-height:1.6">Hi ${esc(d.leadName)},</p>
     <p style="margin:0 0 12px;font-size:14px;line-height:1.6">${esc(step.intro)}</p>
     <div style="font-size:14px;line-height:1.6">${esc(step.body).replace(/\n/g, "<br>")}</div>
     <p style="margin:18px 0 0;font-size:14px;line-height:1.6">Warm regards,<br><strong>${esc(d.siteName)}</strong></p>
     ${contact ? `<p style="margin:10px 0 0;font-size:12px;color:#6b7280">${contact}</p>` : ""}`,
    d.siteName,
  );
}
