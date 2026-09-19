import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { clientIp, clientUserAgent, type AdminActor } from "@/lib/guard";
import type { Prisma } from "@prisma/client";

/**
 * Admin activity / audit log.
 *
 * Writes are append-only and must never break the operation they describe —
 * every call is wrapped so a logging failure cannot roll back a booking.
 */

export const ACTIVITY_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "PAYMENT",
  "ASSIGN",
  "UPLOAD",
  "EXPORT",
  "SETTINGS",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ENTITIES = [
  "Auth",
  "Booking",
  "Lead",
  "Customer",
  "TravelPackage",
  "Destination",
  "BlogPost",
  "Page",
  "Media",
  "Coupon",
  "Testimonial",
  "Redirect",
  "SalesDocument",
  "User",
  "Settings",
  "Seo",
  "Export",
] as const;

export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export type ActivityInput = {
  actor?: AdminActor | null;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string | null;
  /** One human sentence: "Updated booking VD-20260918-4821". */
  description: string;
  /** Small structured detail — changed fields, old/new status, amounts. */
  metadata?: Record<string, unknown> | null;
  /** Set false for background jobs where there is no incoming request. */
  captureRequest?: boolean;
};

/**
 * Record one privileged action. Also emits a structured server log line so the
 * event is visible in a log drain even if the database write fails.
 */
export async function recordActivity(input: ActivityInput): Promise<void> {
  const { actor, action, entity, entityId, description, metadata } = input;

  logger.admin(`${action.toLowerCase()}.${entity.toLowerCase()}`, {
    userId: actor?.id,
    entityId,
    description,
    ...(metadata ?? {}),
  });

  try {
    const capture = input.captureRequest !== false;
    const [ipAddress, userAgent] = capture
      ? await Promise.all([clientIp(), clientUserAgent()])
      : [null, null];

    await prisma.activityLog.create({
      data: {
        userId: actor?.id ?? null,
        userName: actor?.name || actor?.email || null,
        userRole: actor?.role || null,
        action,
        entity,
        entityId: entityId ?? null,
        description,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: ipAddress === "unknown" ? null : ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Never let auditing break the operation it is auditing.
    logger.error("activity.write_failed", { action, entity, entityId, error });
  }
}

/** Describe what changed between two versions of a record, for `metadata`. */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T,
  fields: (keyof T)[],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (!before) return changes;
  for (const field of fields) {
    const from = normalise(before[field]);
    const to = normalise(after[field]);
    if (from !== to) changes[String(field)] = { from, to };
  }
  return changes;
}

function normalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}

export type ActivityFilters = {
  q?: string;
  userId?: string;
  action?: string;
  entity?: string;
  from?: Date;
  to?: Date;
  page?: number;
  perPage?: number;
};

/** Paginated activity feed for /admin/activity-log. */
export async function listActivity(filters: ActivityFilters) {
  const perPage = Math.min(Math.max(filters.perPage ?? 50, 1), 200);
  const page = Math.max(filters.page ?? 1, 1);

  const where: Prisma.ActivityLogWhereInput = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.entity) where.entity = filters.entity;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { userName: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        userName: true,
        userRole: true,
        action: true,
        entity: true,
        entityId: true,
        description: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}
