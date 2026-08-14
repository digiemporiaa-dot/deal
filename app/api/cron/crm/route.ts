import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/email/mailer";
import { getSettings } from "@/lib/settings";
import { followUpDigestEmail, sequenceEmail, SEQUENCE_STEPS } from "@/lib/email/crm-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://vacation-deal.vercel.app";
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Background CRM jobs, run once a day by Vercel Cron.
 *
 *  1. Nurture sequence — leads nobody has replied to get up to 3 automatic
 *     emails (after 1 hour, 2 days, 5 days). Any human action stops it.
 *  2. Follow-up digest — each team member gets one email listing their
 *     overdue and due-today leads.
 */
export async function GET(request: Request) {
  // Vercel Cron sends this header; a manual call must carry CRON_SECRET.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const isVercelCron = request.headers.get("user-agent")?.includes("vercel-cron");
  if (secret && !isVercelCron && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  const now = new Date();
  let sequenceSent = 0;
  let digestsSent = 0;

  /* ---------- 1. Nurture sequence ---------- */
  const candidates = await prisma.lead.findMany({
    where: {
      sequenceStoppedAt: null,
      sequenceStage: { lt: SEQUENCE_STEPS.length },
      email: { not: null },
      status: { in: ["NEW", "CONTACTED"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      createdAt: true,
      sequenceStage: true,
    },
    take: 200,
  });

  for (const lead of candidates) {
    const nextStage = lead.sequenceStage + 1;
    const step = SEQUENCE_STEPS.find((s) => s.stage === nextStage);
    if (!step || !lead.email) continue;

    const dueAt = new Date(lead.createdAt.getTime() + step.afterHours * 60 * 60 * 1000);
    if (dueAt > now) continue;

    const delivered = await sendMail({
      to: lead.email,
      subject: step.subject,
      html: sequenceEmail({
        siteName: settings.siteName,
        leadName: lead.name,
        stage: nextStage,
        phone: settings.phone || null,
        whatsapp: settings.whatsapp || null,
      }),
      replyTo: process.env.ADMIN_NOTIFY_EMAIL || undefined,
    });

    await prisma.lead.update({ where: { id: lead.id }, data: { sequenceStage: nextStage } });
    await prisma.leadNote.create({
      data: {
        leadId: lead.id,
        type: "EMAIL",
        subject: `${step.subject} (automatic follow-up ${nextStage} of ${SEQUENCE_STEPS.length})`,
        emailTo: lead.email,
        delivered,
        body: `${step.intro}\n\n${step.body}`,
      },
    });
    if (delivered) sequenceSent += 1;
  }

  /* ---------- 2. Follow-up digest per team member ---------- */
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const dueLeads = await prisma.lead.findMany({
    where: {
      nextFollowUpAt: { not: null, lte: endOfToday },
      status: { notIn: ["CONVERTED", "LOST"] },
      assignedToId: { not: null },
    },
    select: {
      id: true,
      name: true,
      destination: true,
      nextFollowUpAt: true,
      assignedTo: { select: { id: true, name: true, email: true, isActive: true } },
    },
  });

  const byStaff = new Map<string, typeof dueLeads>();
  for (const lead of dueLeads) {
    if (!lead.assignedTo?.isActive || !lead.assignedTo.email) continue;
    const list = byStaff.get(lead.assignedTo.id) ?? [];
    list.push(lead);
    byStaff.set(lead.assignedTo.id, list);
  }

  for (const [, leads] of byStaff) {
    const staff = leads[0].assignedTo;
    if (!staff?.email) continue;

    const overdue = leads
      .filter((l) => l.nextFollowUpAt && l.nextFollowUpAt < startOfToday)
      .map((l) => ({ name: l.name, destination: l.destination, due: fmt(l.nextFollowUpAt as Date), url: `${baseUrl()}/admin/leads/${l.id}` }));
    const today = leads
      .filter((l) => l.nextFollowUpAt && l.nextFollowUpAt >= startOfToday)
      .map((l) => ({ name: l.name, destination: l.destination, due: "today", url: `${baseUrl()}/admin/leads/${l.id}` }));

    if (!overdue.length && !today.length) continue;

    const sent = await sendMail({
      to: staff.email,
      subject: `${overdue.length + today.length} follow-up${overdue.length + today.length === 1 ? "" : "s"} waiting for you`,
      html: followUpDigestEmail({ siteName: settings.siteName, staffName: staff.name, overdue, today }),
    });
    if (sent) digestsSent += 1;
  }

  return NextResponse.json({ ok: true, sequenceSent, digestsSent, checked: candidates.length });
}
