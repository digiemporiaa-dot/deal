"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** Normalise to a leading-slash path with no trailing slash: "/old-page". */
function normalisePath(value: string): string {
  let v = value.trim();
  if (!v) return "";
  v = v.replace(/^https?:\/\/[^/]+/i, ""); // allow pasting a full URL
  if (!v.startsWith("/")) v = `/${v}`;
  v = v.replace(/\/+$/, "");
  return v || "/";
}

const schema = z.object({
  source: z.string().trim().min(1, "Old URL is required"),
  target: z.string().trim().min(1, "New URL is required"),
  permanent: z.boolean().default(true),
  isActive: z.boolean().default(true),
  note: z.string().trim().optional().nullable(),
});

export type RedirectInput = z.input<typeof schema>;

export async function saveRedirect(input: RedirectInput, id?: string) {
  await requireAdmin();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form" };

  const source = normalisePath(parsed.data.source);
  const target = parsed.data.target.trim().startsWith("http")
    ? parsed.data.target.trim()
    : normalisePath(parsed.data.target);

  if (!source || !target) return { ok: false as const, error: "Both URLs are required" };
  if (source === target) return { ok: false as const, error: "The two URLs cannot be the same" };
  if (source.startsWith("/admin") || source.startsWith("/api")) {
    return { ok: false as const, error: "Admin and API paths cannot be redirected" };
  }

  const clash = await prisma.redirect.findUnique({ where: { source } });
  if (clash && clash.id !== id) {
    return { ok: false as const, error: `A redirect for ${source} already exists` };
  }

  const data = {
    source,
    target,
    permanent: parsed.data.permanent,
    isActive: parsed.data.isActive,
    note: parsed.data.note || null,
  };

  if (id) await prisma.redirect.update({ where: { id }, data });
  else await prisma.redirect.create({ data });

  revalidatePath("/admin/redirects");
  return { ok: true as const };
}

export async function toggleRedirect(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.redirect.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/redirects");
  return { ok: true as const };
}

export async function deleteRedirect(id: string) {
  await requireAdmin();
  await prisma.redirect.delete({ where: { id } });
  revalidatePath("/admin/redirects");
  return { ok: true as const };
}
