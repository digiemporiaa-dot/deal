import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadSchema } from "@/lib/validation";
import { sendMail, ADMIN_NOTIFY_EMAIL } from "@/lib/email/mailer";
import { newLeadAdminEmail } from "@/lib/email/templates";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Basic rate limiting per IP to prevent spam.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`lead:${ip}`, 8, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again in a minute." },
      { status: 429 },
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
      { ok: false, error: "Please check the form and try again.", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const d = parsed.data;
  try {
    const lead = await prisma.lead.create({
      data: {
        name: d.name,
        email: d.email || null,
        phone: d.phone,
        whatsapp: d.whatsapp || null,
        destination: d.destination || null,
        travelDate: d.travelDate ? new Date(d.travelDate) : null,
        travellers: d.travellers ?? null,
        budget: d.budget || null,
        message: d.message || null,
        source: d.source || "website",
      },
    });

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
    console.error("[api/leads] error", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again or WhatsApp us." },
      { status: 500 },
    );
  }
}
