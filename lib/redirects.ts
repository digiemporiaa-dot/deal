import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Redirect engine.
 *
 * Rules live in the database so a non-technical admin can manage them at
 * /admin/redirects. They are resolved in `app/not-found.tsx`, which runs only
 * when no route matched — so the lookup costs nothing on pages that exist.
 */

/** Status codes the manager offers. 301/308 are permanent, 302/307 temporary. */
export const REDIRECT_STATUS_CODES = [301, 302, 307, 308] as const;
export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number];

export function isRedirectStatusCode(value: number): value is RedirectStatusCode {
  return (REDIRECT_STATUS_CODES as readonly number[]).includes(value);
}

export function isPermanentStatus(code: number): boolean {
  return code === 301 || code === 308;
}

/** Longest chain we will follow before declaring a loop. */
const MAX_CHAIN = 5;

/** Normalise to a leading-slash path with no trailing slash: "/old-page". */
export function normalisePath(value: string): string {
  let v = (value || "").trim();
  if (!v) return "";
  v = v.replace(/^https?:\/\/[^/]+/i, ""); // allow pasting a full URL
  v = v.split("#")[0]!;
  if (!v.startsWith("/")) v = `/${v}`;
  v = v.replace(/\/+/g, "/");
  if (v.length > 1) v = v.replace(/\/+$/, "");
  return v || "/";
}

/** A target may be an internal path or an absolute URL on another host. */
export function normaliseTarget(value: string): string {
  const v = (value || "").trim();
  if (/^https?:\/\//i.test(v)) return v;
  return normalisePath(v);
}

export type ResolvedRedirect = { target: string; statusCode: number };

/**
 * Follow the redirect chain for `path`, returning the final destination.
 *
 * Chains are collapsed so visitors and crawlers make one hop instead of
 * several. A cycle, or a chain longer than MAX_CHAIN, resolves to null and is
 * logged rather than sending the visitor round in circles.
 */
export async function resolveRedirect(path: string): Promise<ResolvedRedirect | null> {
  const start = normalisePath(path);
  if (!start || start === "/") return null;

  const seen = new Set<string>([start]);
  let current = start;
  let statusCode = 301;
  let hops = 0;

  while (hops < MAX_CHAIN) {
    const rule: { target: string; statusCode: number; permanent: boolean } | null =
      await prisma.redirect.findFirst({
        where: { source: current, isActive: true },
        select: { target: true, statusCode: true, permanent: true },
      });
    if (!rule) break;

    // Rows created before statusCode existed fall back to `permanent`.
    statusCode = isRedirectStatusCode(rule.statusCode)
      ? rule.statusCode
      : rule.permanent
        ? 301
        : 302;

    const next = normaliseTarget(rule.target);

    // External targets end the chain.
    if (/^https?:\/\//i.test(next)) {
      await countHit(current);
      return { target: next, statusCode };
    }

    if (seen.has(next)) {
      logger.warn("redirect.loop_detected", { start, at: current, next });
      return null;
    }

    seen.add(next);
    await countHit(current);
    current = next;
    hops += 1;
  }

  if (hops >= MAX_CHAIN) {
    logger.warn("redirect.chain_too_long", { start, hops });
    return null;
  }

  return current === start ? null : { target: current, statusCode };
}

/** Hit counters are advisory — a failure must never block the redirect. */
async function countHit(source: string): Promise<void> {
  try {
    await prisma.redirect.updateMany({ where: { source }, data: { hits: { increment: 1 } } });
  } catch {
    /* ignore */
  }
}

/**
 * Would adding `source -> target` create a cycle? Called before saving a rule
 * so the manager can reject it with a clear message instead of breaking a URL.
 */
export async function wouldLoop(source: string, target: string): Promise<boolean> {
  const from = normalisePath(source);
  const to = normaliseTarget(target);
  if (/^https?:\/\//i.test(to)) return false;
  if (from === to) return true;

  const seen = new Set<string>([from, to]);
  let current = to;

  for (let i = 0; i < MAX_CHAIN; i += 1) {
    const rule = await prisma.redirect.findFirst({
      where: { source: current, isActive: true },
      select: { target: true },
    });
    if (!rule) return false;
    const next = normaliseTarget(rule.target);
    if (/^https?:\/\//i.test(next)) return false;
    if (seen.has(next)) return true;
    seen.add(next);
    current = next;
  }
  // A chain this long is treated as a loop rather than silently accepted.
  return true;
}

/**
 * Preserve an indexed URL when a slug changes.
 *
 * Called by the package / destination / blog / page actions. It is best-effort:
 * failing to write a redirect must not fail the edit the admin just made.
 */
export async function createSlugRedirect(input: {
  oldPath: string;
  newPath: string;
  note?: string;
}): Promise<void> {
  const source = normalisePath(input.oldPath);
  const target = normalisePath(input.newPath);
  if (!source || !target || source === target) return;
  if (source.startsWith("/admin") || source.startsWith("/api")) return;

  try {
    if (await wouldLoop(source, target)) {
      logger.warn("redirect.slug_change_would_loop", { source, target });
      return;
    }

    // Any existing rule pointing at the old path should now point at the new
    // one, so old chains stay one hop long.
    await prisma.redirect.updateMany({
      where: { target: source, isActive: true },
      data: { target },
    });

    await prisma.redirect.upsert({
      where: { source },
      create: {
        source,
        target,
        permanent: true,
        statusCode: 301,
        isActive: true,
        note: input.note ?? "Created automatically when the slug changed",
      },
      update: { target, isActive: true, permanent: true, statusCode: 301 },
    });

    logger.info("redirect.slug_change_recorded", { source, target });
  } catch (error) {
    logger.error("redirect.slug_change_failed", { source, target, error });
  }
}
