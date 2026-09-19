import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  hasPermission,
  hasAnyPermission,
  isLeadOwnerOnly,
  type Permission,
} from "@/lib/permissions";
import { forbidden, unauthenticated, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Server-side authorization guards.
 *
 * Every Server Action and route handler that reads or changes privileged data
 * must call one of these. They re-read the session from the cookie on each
 * call — nothing here trusts an argument, a header or a hidden form field.
 */

export type AdminActor = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/** The signed-in admin user, or null. Never throws. */
export async function currentUser(): Promise<AdminActor | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    role: (user as { role?: string }).role ?? "",
  };
}

/** Require a signed-in admin user. Throws 401 otherwise. */
export async function requireUser(): Promise<AdminActor> {
  const user = await currentUser();
  if (!user) throw unauthenticated();
  return user;
}

/**
 * Require a specific permission. Throws 401 when signed out and 403 when the
 * role does not carry it. Denials are logged so probing is visible.
 */
export async function requirePermission(permission: Permission): Promise<AdminActor> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    logger.security("permission_denied", {
      userId: user.id,
      role: user.role,
      permission,
    });
    throw forbidden(undefined, { permission, role: user.role });
  }
  return user;
}

/** Require at least one of several permissions. */
export async function requireAnyPermission(permissions: Permission[]): Promise<AdminActor> {
  const user = await requireUser();
  if (!hasAnyPermission(user.role, permissions)) {
    logger.security("permission_denied", {
      userId: user.id,
      role: user.role,
      permission: permissions.join("|"),
    });
    throw forbidden(undefined, { permissions, role: user.role });
  }
  return user;
}

/** Non-throwing variant for conditionally rendering admin UI. */
export async function can(permission: Permission): Promise<boolean> {
  const user = await currentUser();
  return hasPermission(user?.role, permission);
}

/**
 * True when this user may only work the records assigned to them. Callers must
 * add the owner filter to their query — see `ownerScope()`.
 */
export function ownLeadsOnly(actor: AdminActor | null): boolean {
  return isLeadOwnerOnly(actor?.role);
}

/**
 * Prisma `where` fragment restricting a query to the actor's own records.
 * Returns `{}` for roles that can see everything.
 *
 * The impossible id for restricted roles without a session id is deliberate:
 * a missing id must return nothing, never everything.
 */
export function ownerScope(
  actor: AdminActor | null,
  field = "assignedToId",
): Record<string, string> {
  if (!ownLeadsOnly(actor)) return {};
  return { [field]: actor?.id || "__no_such_user__" };
}

/** Best-effort client IP, for rate limiting and the activity log. */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
    return h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

/** Truncated user agent for the activity log. */
export async function clientUserAgent(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    return null;
  }
}

/** Same as `clientIp()` but for route handlers that already hold the Request. */
export function ipFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Non-throwing guard for Server Actions, which return `{ ok, error }` rather
 * than throwing. Use `requirePermission()` in route handlers, this in actions.
 */
export async function guardAction(
  permission: Permission,
): Promise<{ ok: true; actor: AdminActor } | { ok: false; error: string }> {
  try {
    const actor = await requirePermission(permission);
    return { ok: true, actor };
  } catch (error) {
    return {
      ok: false,
      error: isAppError(error) ? error.message : "You do not have permission to do that.",
    };
  }
}

/** As `guardAction`, but any one of the listed permissions is enough. */
export async function guardAnyAction(
  permissions: Permission[],
): Promise<{ ok: true; actor: AdminActor } | { ok: false; error: string }> {
  try {
    const actor = await requireAnyPermission(permissions);
    return { ok: true, actor };
  } catch (error) {
    return {
      ok: false,
      error: isAppError(error) ? error.message : "You do not have permission to do that.",
    };
  }
}
