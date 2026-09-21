import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, ipFromRequest } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError, AppError } from "@/lib/errors";
import { limitFor } from "@/lib/rate-limit";
import { readImageMeta, safeFilename } from "@/lib/image-meta";
import { uploadFile } from "@/lib/storage";
import { fetchRemoteImage } from "@/lib/fetch-image";
import { mediaQuerySchema } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/** 8 MB. Large enough for a hero photo, small enough to bound memory. */
const MAX_SIZE = 8 * 1024 * 1024;

/**
 * Upload an image into the media library.
 *
 * The declared Content-Type and the filename are both ignored for security
 * decisions: the format is read from the file's own magic bytes, the stored
 * name is generated, and the extension comes from the detected format. That
 * closes off executable uploads, `shell.php.jpg`, path traversal and SVGs
 * carrying script.
 *
 * Bytes arrive one of two ways: a `file` the admin chose, or a `url` for this
 * server to download — which is how an image already hosted somewhere else is
 * brought onto this machine. Both meet at the same magic-byte check and the
 * same storage call, so an imported image is stored exactly like an uploaded
 * one. The download itself is guarded in `lib/fetch-image.ts`, because a URL
 * the caller picks is an SSRF risk before it is anything else.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePermission("media:upload");

    const throttle = limitFor("upload", actor.id);
    if (!throttle.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many uploads. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const sourceUrl = String(formData.get("url") || "").trim();

    let buffer: Buffer;
    let originalName: string;

    if (file instanceof File) {
      if (file.size === 0) {
        return NextResponse.json({ ok: false, error: "That file is empty." }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { ok: false, error: "File too large (maximum 8MB)." },
          { status: 413 },
        );
      }
      buffer = Buffer.from(await file.arrayBuffer());
      originalName = String(file.name || "");
    } else if (sourceUrl) {
      const fetched = await fetchRemoteImage(sourceUrl, MAX_SIZE);
      buffer = fetched.buffer;
      originalName = fetched.filename;
    } else {
      return NextResponse.json({ ok: false, error: "No file or URL provided" }, { status: 400 });
    }

    // The only check that decides whether this is an image.
    const meta = readImageMeta(buffer);
    if (!meta) {
      return NextResponse.json(
        {
          ok: false,
          error: "That file is not a supported image. Use JPG, PNG, WEBP, GIF or AVIF.",
        },
        { status: 415 },
      );
    }

    const folderInput = String(formData.get("folder") || "general");
    const folder = folderInput.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "general";

    const filename = safeFilename(originalName || "image", meta.extension);
    const stored = await uploadFile({
      buffer,
      filename,
      mimeType: meta.mimeType,
      folder,
    });

    const media = await prisma.media.create({
      data: {
        url: stored.url,
        filename,
        originalFilename: originalName.slice(0, 200) || null,
        mimeType: meta.mimeType,
        size: buffer.byteLength,
        width: meta.width,
        height: meta.height,
        folder,
        storageProvider: stored.provider,
        storageKey: stored.key,
        alt: String(formData.get("alt") || "").slice(0, 300) || null,
        title: String(formData.get("title") || "").slice(0, 200) || null,
        createdById: actor.id,
      },
    });

    await recordActivity({
      actor,
      action: "UPLOAD",
      entity: "Media",
      entityId: media.id,
      description: sourceUrl ? `Imported ${filename} from a URL` : `Uploaded ${filename}`,
      metadata: {
        folder,
        mimeType: meta.mimeType,
        size: buffer.byteLength,
        provider: stored.provider,
        ...(sourceUrl ? { sourceUrl } : {}),
      },
    });

    return NextResponse.json({ ok: true, media });
  } catch (error) {
    const safe = toSafeError(error, "api.media.upload", { ip: ipFromRequest(request) });
    return NextResponse.json({ ok: false, error: safe.message }, { status: safe.status });
  }
}

/** Paginated, searchable listing for the media library and the picker. */
export async function GET(request: Request) {
  try {
    await requirePermission("media:view");

    const url = new URL(request.url);
    const parsed = mediaQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Those search filters are not valid.");
    }
    const { q, folder, page, perPage } = parsed.data;

    const where: Prisma.MediaWhereInput = {};
    if (folder) where.folder = folder;
    if (q) {
      where.OR = [
        { filename: { contains: q, mode: "insensitive" } },
        { originalFilename: { contains: q, mode: "insensitive" } },
        { alt: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { caption: { contains: q, mode: "insensitive" } },
      ];
    }

    const [media, total, folders] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.media.count({ where }),
      prisma.media.groupBy({ by: ["folder"], _count: { _all: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      media,
      total,
      page,
      perPage,
      pageCount: Math.max(1, Math.ceil(total / perPage)),
      folders: folders
        .map((f) => ({ folder: f.folder, count: f._count._all }))
        .sort((a, b) => a.folder.localeCompare(b.folder)),
    });
  } catch (error) {
    const safe = toSafeError(error, "api.media.list");
    return NextResponse.json({ ok: false, error: safe.message }, { status: safe.status });
  }
}
