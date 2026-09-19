import { NextResponse } from "next/server";
import { leadSchema } from "@/lib/validation";
import { createLead } from "@/lib/services/lead";
import { sendMail, ADMIN_NOTIFY_EMAIL } from "@/lib/email/mailer";
import { newLeadAdminEmail } from "@/lib/email/templates";
import { limitFor } from "@/lib/rate-limit";
import { ipFromRequest } from "@/lib/guard";
import { toSafeError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = ipFromRequest(request);

  const throttle = limitFor("lead", ip);
  if (!throttle.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please check the form and try again.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const d = parsed.data;
  try {
    // Attribution is read from the httpOnly cookie inside createLead().
    const lead = await createLead(d);

    // Fire-and-forget admin notification (never blocks the response).
    void sendMail({
      to: ADMIN_NOTIFY_EMAIL,
      subject: `New enquiry from ${d.name}`,
      html: newLeadAdminEmail({
        name: d.name,
        phone: d.phone,
        email: d.email,
        destination: d.destination,
        message: d.message,
      }),
      replyTo: d.email || undefined,
    });

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    toSafeError(err, "api.leads.create", { ip });
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again or WhatsApp us." },
      { status: 500 },
    );
  }
}
