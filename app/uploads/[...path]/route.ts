import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { resolveUploadPath } from "@/lib/storage";

export const runtime = "nodejs";
// The file for a given URL never changes — names carry a timestamp and a
// random suffix — but the *set* of files does, so the route itself must not
// be prerendered into a fixed list.
export const dynamic = "force-dynamic";

/**
 * Serve uploaded media.
 *
 * This route exists because Next's static handler indexes `public/` when the
 * server boots and does not look again: a file uploaded while the server is
 * running is invisible to it, and every freshly uploaded image 404s until the
 * process restarts. That is fine on a platform that redeploys per change, and
 * plainly wrong on a VPS running one long-lived process.
 *
 * So uploads are served from disk on request, wherever UPLOAD_DIR points —
 * including the default inside `public/`. For files that were already there
 * at boot Next answers first and never reaches this; either way the bytes are
 * the same, and anything this route serves passes the allow-list below.
 *
 * A reverse proxy can take over entirely — an `alias` for /uploads/ in nginx
 * serves the same files without waking Node — but nothing has to be
 * configured for uploads to work.
 */

/**
 * Extensions this route will serve, mapped to the type it declares.
 *
 * An allow-list, not a lookup: the media library only ever stores images, and
 * anything else appearing in that directory arrived by a route this app does
 * not have. Serving it — an .html, an .svg carrying script, a stray .env —
 * would turn an upload directory into a file server.
 */
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) return notFound();

  const target = resolveUploadPath(segments.join("/"));
  if (!target) return notFound();

  const extension = path.extname(target).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return notFound();

  let info;
  try {
    info = await stat(target);
  } catch {
    return notFound();
  }
  if (!info.isFile()) return notFound();

  // Uploaded names are unique per upload, so a given URL always refers to the
  // same bytes and can be cached hard. The ETag still lets a browser
  // revalidate cheaply after that year is up.
  const etag = `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
  const headers = {
    "Content-Type": contentType,
    "Content-Length": String(info.size),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Last-Modified": info.mtime.toUTCString(),
    ETag: etag,
  };

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  // Streamed rather than read into memory: an 8 MB upload per concurrent
  // request adds up, and there is no reason to buffer bytes that are only
  // being passed along.
  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
  return new NextResponse(stream, { headers });
}
