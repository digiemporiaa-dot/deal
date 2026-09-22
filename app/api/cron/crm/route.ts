import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ipFromRequest } from "@/lib/guard";
import { sendMail } from "@/lib/email/mailer";
import { getSettings } from "@/lib/settings";
import { CLOSED_STATUSES } from "@/lib/crm";
import { rescoreAllLeads } from "@/lib/services/lead-scoring";
import {
  followUpDigestEmail,
  escalationDigestEmail,
  sequenceEmail,
  SEQUENCE_STEPS,
  type DigestTask,
} from "@/lib/email/crm-emails";
import { alreadyRanToday, recordCronRun } from "@/lib/activity";
import {
  dueFollowUpsByOwner,
  escalatedFollowUps,
  followUpTypeLabel,
  ESCALATION_DAYS,
} from "@/lib/services/follow-up";

/**
 * Who hears about a follow-up going cold.
 *
 * Deliberately not everyone with `leads:view` — an escalation that lands in
 * twenty inboxes is an escalation nobody owns.
 */
const ESCALATION_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Constant-time comparison so the secret cannot be guessed byte by byte. */
function timingSafeMatch(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
 *  3. Escalation — follow-ups nobody has touched for days go to the managers,
 *     because another copy to the owner who is already ignoring them is not
 *     an escalation.
 *  4. Score refresh — lead scores are stored, so they drift as travel dates
 *     approach. This brings them back in line.
 *
 * Every email is guarded per recipient per day, because cron is at-least-once
 * and a digest that arrives twice is a digest people stop opening.
 */
export async function GET(request: Request) {
  // Vercel Cron signs its calls with CRON_SECRET in the Authorization header.
  // A user-agent string is not proof of anything — anyone can send one — so it
  // is not accepted on its own. Without a configured secret the endpoint is
  // closed in production and open in development.
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.security("cron_secret_missing", {});
      return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
    }
  } else if (!timingSafeMatch(header, `Bearer ${secret}`)) {
    logger.security("cron_unauthorized", { ip: ipFromRequest(request) });
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
  //
  // Reads the follow-up tasks, not `Lead.nextFollowUpAt`. That column holds
  // one date per lead, so a lead with three things outstanding produced one
  // digest line and no clue what any of them were for.
  //
  // Each recipient is guarded separately: cron is at-least-once, and a person
  // who gets their list twice in ten minutes stops reading it. The guard is
  // per person rather than per run so that a job which dies half-way resumes
  // rather than either repeating everyone or skipping the rest.
  const owners = await dueFollowUpsByOwner(now);
  const dayKey = now.toISOString().slice(0, 10);
  let digestsSkipped = 0;

  for (const owner of owners) {
    if (!owner.overdue.length && !owner.today.length) continue;

    const key = `followup-digest:${owner.id}:${dayKey}`;
    if (await alreadyRanToday(key)) {
      digestsSkipped += 1;
      continue;
    }

    const toTask = (row: (typeof owner.overdue)[number], due: string): DigestTask => ({
      title: row.title,
      kind: followUpTypeLabel(row.type),
      leadName: row.lead.name,
      destination: row.lead.destination,
      due,
      url: `${baseUrl()}/admin/leads/${row.leadId}`,
    });

    const overdue = owner.overdue.map((row) => toTask(row, fmt(row.dueAt)));
    const today = owner.today.map((row) => toTask(row, "today"));
    const count = overdue.length + today.length;

    const sent = await sendMail({
      to: owner.email,
      subject: `${count} follow-up${count === 1 ? "" : "s"} waiting for you`,
      html: followUpDigestEmail({
        siteName: settings.siteName,
        staffName: owner.name,
        overdue,
        today,
      }),
    });

    if (sent) {
      digestsSent += 1;
      // Recorded only on a successful send, so a failed delivery is retried
      // by the next run rather than marked done and lost.
      await recordCronRun(key, `Sent ${count} follow-up(s) to ${owner.name}`, {
        overdue: overdue.length,
        today: today.length,
      });
    }
  }

  /* ---------- 2b. Escalation to managers ---------- */
  //
  // A task the owner has ignored for days does not need a fourth copy of the
  // same digest — it needs somebody who can reassign it. Managers get one
  // list of everything going cold across the team.
  let escalationsSent = 0;
  const stale = await escalatedFollowUps(now);

  if (stale.length > 0) {
    const managers = await prisma.user.findMany({
      where: { isActive: true, role: { in: ESCALATION_ROLES } },
      select: { id: true, name: true, email: true },
    });

    for (const manager of managers) {
      if (!manager.email) continue;

      const key = `followup-escalation:${manager.id}:${dayKey}`;
      if (await alreadyRanToday(key)) continue;

      const sent = await sendMail({
        to: manager.email,
        subject: `${stale.length} follow-up${stale.length === 1 ? "" : "s"} going cold`,
        html: escalationDigestEmail({
          siteName: settings.siteName,
          managerName: manager.name,
          days: ESCALATION_DAYS,
          tasks: stale.slice(0, 50).map((task) => ({
            title: task.title,
            leadName: task.lead.name,
            owner: task.assignedTo?.name ?? null,
            daysLate: task.daysLate,
            url: `${baseUrl()}/admin/leads/${task.leadId}`,
          })),
        }),
      });

      if (sent) {
        escalationsSent += 1;
        await recordCronRun(key, `Escalated ${stale.length} stale follow-up(s) to ${manager.name}`, {
          stale: stale.length,
        });
      }
    }
  }

  // 3. Refresh lead scores.
  //
  // Scores are stored so the CRM can sort and filter on them in the database,
  // which means they go stale on their own: a trip that was six months out in
  // March is three weeks out in August, and nobody edited the lead. Runs last
  // and never fails the request — the emails above are the job that matters,
  // and a stale score is a cosmetic problem.
  let rescored = { scanned: 0, changed: 0 };
  try {
    rescored = await rescoreAllLeads();
  } catch (error) {
    logger.error("cron.rescore_failed", { error });
  }

  logger.info("cron.crm_completed", {
    sequenceSent,
    digestsSent,
    digestsSkipped,
    escalationsSent,
    stale: stale.length,
    checked: candidates.length,
    rescored: rescored.changed,
  });
  return NextResponse.json({
    ok: true,
    sequenceSent,
    digestsSent,
    digestsSkipped,
    escalationsSent,
    stale: stale.length,
    checked: candidates.length,
    rescored: rescored.changed,
  });
}
