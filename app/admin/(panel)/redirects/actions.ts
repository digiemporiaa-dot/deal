"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import {
  normalisePath,
  normaliseTarget,
  wouldLoop,
  isPermanentStatus,
  REDIRECT_STATUS_CODES,
} from "@/lib/redirects";

const schema = z.object({
  source: z.string().trim().min(1, "Old URL is required").max(500),
  target: z.string().trim().min(1, "New URL is required").max(1000),
  statusCode: z.coerce
    .number()
    .int()
    .refine(
      (v): v is (typeof REDIRECT_STATUS_CODES)[number] =>
        (REDIRECT_STATUS_CODES as readonly number[]).includes(v),
      { message: "Choose 301, 302, 307 or 308" },
    )
    .default(301),
  isActive: z.boolean().default(true),
  note: z.string().trim().max(300).optional().nullable(),
});

export type RedirectInput = z.input<typeof schema>;

/** Paths that must never be redirected away from. */
function isProtectedSource(source: string): boolean {
  return (
    source.startsWith("/admin") ||
    source.startsWith("/api") ||
    source === "/sitemap.xml" ||
    source === "/robots.txt"
  );
}

export async function saveRedirect(input: RedirectInput, id?: string) {
  const guard = await guardAction("redirects:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form" };
  }

  const source = normalisePath(parsed.data.source);
  const target = normaliseTarget(parsed.data.target);

  if (!source || !target) return { ok: false as const, error: "Both URLs are required" };
  if (source === target) return { ok: false as const, error: "The two URLs cannot be the same" };
  if (isProtectedSource(source)) {
    return { ok: false as const, error: "Admin, API and sitemap paths cannot be redirected" };
  }

  try {
    const clash = await prisma.redirect.findUnique({ where: { source }, select: { id: true } });
    if (clash && clash.id !== id) {
      return { ok: false as const, error: `A redirect for ${source} already exists` };
    }

    // Refuse anything that would send a visitor round in circles.
    if (await wouldLoop(source, target)) {
      return {
        ok: false as const,
        error: "That would create a redirect loop — the destination leads back to this URL.",
      };
    }

    const data = {
      source,
      target,
      statusCode: parsed.data.statusCode,
      permanent: isPermanentStatus(parsed.data.statusCode),
      isActive: parsed.data.isActive,
      note: parsed.data.note || null,
    };

    if (id) await prisma.redirect.update({ where: { id }, data });
    else await prisma.redirect.create({ data });

    await recordActivity({
      actor: guard.actor,
      action: id ? "UPDATE" : "CREATE",
      entity: "Redirect",
      entityId: id ?? null,
      description: `${id ? "Updated" : "Created"} redirect ${source} → ${target}`,
      metadata: { source, target, statusCode: data.statusCode, isActive: data.isActive },
    });

    revalidatePath("/admin/redirects");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.saveRedirect", { id }).message };
  }
}

export async function toggleRedirect(id: string, isActive: boolean) {
  const guard = await guardAction("redirects:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  try {
    const row = await prisma.redirect.update({ where: { id }, data: { isActive } });
    await recordActivity({
      actor: guard.actor,
      action: "STATUS_CHANGE",
      entity: "Redirect",
      entityId: id,
      description: `${isActive ? "Enabled" : "Disabled"} redirect ${row.source}`,
      metadata: { source: row.source, isActive },
    });
    revalidatePath("/admin/redirects");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.toggleRedirect", { id }).message };
  }
}

export async function deleteRedirect(id: string) {
  const guard = await guardAction("redirects:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  try {
    const row = await prisma.redirect.delete({ where: { id } });
    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Redirect",
      entityId: id,
      description: `Deleted redirect ${row.source} → ${row.target}`,
    });
    revalidatePath("/admin/redirects");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.deleteRedirect", { id }).message };
  }
}
