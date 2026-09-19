import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError, AppError } from "@/lib/errors";
import { deleteFile } from "@/lib/storage";
import { mediaMetaSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** Update alt text, title, caption and folder — the image SEO fields. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await requirePermission("media:update");
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION", "Invalid request.");
    }

    const parsed = mediaMetaSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message || "Please check the fields.");
    }
    const d = parsed.data;

    const existing = await prisma.media.findUnique({ where: { id }, select: { filename: true } });
    if (!existing) throw new AppError("NOT_FOUND", "That image no longer exists.");

    const media = await prisma.media.update({
      where: { id },
      data: {
        alt: d.alt || null,
        title: d.title || null,
        caption: d.caption || null,
        ...(d.folder ? { folder: d.folder.toLowerCase() } : {}),
      },
    });

    await recordActivity({
      actor,
      action: "UPDATE",
      entity: "Media",
      entityId: id,
      description: `Updated details for ${existing.filename}`,
      metadata: { hasAlt: Boolean(d.alt), folder: media.folder },
    });

    return NextResponse.json({ ok: true, media });
  } catch (error) {
    const safe = toSafeError(error, "api.media.update");
    return NextResponse.json({ ok: false, error: safe.message }, { status: safe.status });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const actor = await requirePermission("media:delete");
    const { id } = await params;

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) throw new AppError("NOT_FOUND", "That image no longer exists.");

    // Remove the stored object first; a failure there is logged, not fatal.
    await deleteFile({
      provider: media.storageProvider,
      key: media.storageKey,
      url: media.url,
    });
    await prisma.media.delete({ where: { id } });

    await recordActivity({
      actor,
      action: "DELETE",
      entity: "Media",
      entityId: id,
      description: `Deleted ${media.filename}`,
      metadata: { url: media.url, provider: media.storageProvider },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeError(error, "api.media.delete");
    return NextResponse.json({ ok: false, error: safe.message }, { status: safe.status });
  }
}
