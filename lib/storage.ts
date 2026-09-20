import "server-only";
import { createHash, createHmac } from "crypto";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

/**
 * Storage abstraction for uploaded media.
 *
 * Business code calls `uploadFile` / `deleteFile` / `getFileUrl` and never
 * learns where the bytes went. The driver is chosen by STORAGE_DRIVER:
 *
 *   local        files on this machine's own disk — the default
 *   vercel-blob  Vercel Blob, via BLOB_READ_WRITE_TOKEN
 *   s3           any S3-compatible bucket, including Cloudflare R2
 *
 * Local storage is a real option on a VPS, where the disk survives restarts.
 * It is not an option on a serverless host, where the filesystem is reset on
 * every deploy and is not shared between instances — there, use one of the
 * other two.
 *
 * Where "local" writes is set by UPLOAD_DIR:
 *
 *   unset                 <app>/public/uploads, served by Next's own static
 *                         handler. Zero configuration, and the default.
 *   /var/www/uploads      any absolute path, served by app/uploads/[...path].
 *
 * Pointing UPLOAD_DIR outside the application directory is what makes local
 * storage survive a deploy. Anything under the app directory is destroyed by
 * the deployment styles that replace it wholesale — a Docker image rebuild,
 * `output: "standalone"`, an rsync with --delete, a release-directory swap —
 * and uploads are the one thing in there that cannot be rebuilt from git.
 */

export type StorageProvider = "local" | "vercel-blob" | "s3";

export type StoredFile = {
  /** Public URL for the stored object. */
  url: string;
  /** Handle used to delete it again — a path, a blob URL, or an object key. */
  key: string;
  provider: StorageProvider;
};

export type UploadInput = {
  buffer: Buffer;
  /** Already sanitised by `safeFilename()`. */
  filename: string;
  mimeType: string;
  /** Logical folder, e.g. "packages". Letters, digits and dashes only. */
  folder?: string;
};

export function storageDriver(): StorageProvider {
  const configured = (process.env.STORAGE_DRIVER || "").toLowerCase();
  if (configured === "vercel-blob" || configured === "s3" || configured === "local") {
    return configured;
  }
  // Infer from whichever credentials are present, so an existing deployment
  // that only set BLOB_READ_WRITE_TOKEN keeps working.
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID) return "s3";
  return "local";
}

function safeFolder(folder: string | undefined): string {
  const cleaned = (folder || "general").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return cleaned || "general";
}

/** Store a file and return its public URL. */
export async function uploadFile(input: UploadInput): Promise<StoredFile> {
  const driver = storageDriver();
  const folder = safeFolder(input.folder);
  // `filename` is produced by safeFilename(); re-check that nothing traversal
  // shaped slipped through before it is joined to a path.
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(input.filename) || input.filename.includes("..")) {
    throw new AppError("VALIDATION", "That file name is not allowed.");
  }

  switch (driver) {
    case "vercel-blob":
      return uploadToVercelBlob(input, folder);
    case "s3":
      return uploadToS3(input, folder);
    default:
      return uploadToLocal(input, folder);
  }
}

/** Remove a stored file. Missing objects are not an error. */
export async function deleteFile(file: {
  provider: string | null | undefined;
  key: string | null | undefined;
  url: string;
}): Promise<void> {
  const provider = (file.provider || inferProvider(file.url)) as StorageProvider;
  const key = file.key || file.url;

  try {
    if (provider === "vercel-blob") await deleteFromVercelBlob(key);
    else if (provider === "s3") await deleteFromS3(key);
    else await deleteFromLocal(key);
  } catch (error) {
    // A stale object costs storage; a failed delete must not block the admin.
    logger.warn("storage.delete_failed", { provider, key, error });
  }
}

/** Public URL for a stored key. */
export function getFileUrl(key: string, provider?: StorageProvider): string {
  if (/^https?:\/\//i.test(key)) return key;
  const driver = provider || storageDriver();
  if (driver === "s3") {
    const base = (process.env.S3_PUBLIC_URL || "").replace(/\/+$/, "");
    return base ? `${base}/${key.replace(/^\/+/, "")}` : `/${key.replace(/^\/+/, "")}`;
  }
  return key.startsWith("/") ? key : `/${key}`;
}

function inferProvider(url: string): StorageProvider {
  if (url.includes(".public.blob.vercel-storage.com")) return "vercel-blob";
  if (/^https?:\/\//i.test(url)) return "s3";
  return "local";
}

/* ─────────────────────────── local ─────────────────────────── */

/** Where the "local" driver keeps its files. Absolute, and never traversed into. */
export function uploadRoot(): string {
  const configured = (process.env.UPLOAD_DIR || "").trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "public", "uploads");
}

/**
 * True when uploads live inside `public/`, where Next's static handler serves
 * them directly. The serving route checks this and stands aside, so the same
 * bytes are never reachable through two different code paths.
 */
export function uploadsArePublic(): boolean {
  const publicDir = path.join(process.cwd(), "public");
  const root = uploadRoot();
  return root === publicDir || root.startsWith(publicDir + path.sep);
}

/**
 * Resolve a request path like "packages/photo-x1y2.jpg" to a file on disk.
 *
 * Returns null rather than throwing for anything that escapes the root, so a
 * caller can answer 404 without distinguishing "missing" from "not allowed" —
 * the difference is only useful to someone probing.
 */
export function resolveUploadPath(relative: string): string | null {
  // Reject before touching the filesystem: encoded traversal, absolute paths,
  // Windows separators, NUL bytes, and dotfiles.
  const decoded = (() => {
    try {
      return decodeURIComponent(relative);
    } catch {
      return null;
    }
  })();

  if (!decoded || decoded.includes("\0") || decoded.includes("\\")) return null;
  if (decoded.startsWith("/") || /^[a-z]:/i.test(decoded)) return null;
  if (decoded.split("/").some((segment) => segment === ".." || segment.startsWith("."))) return null;

  const root = uploadRoot();
  const target = path.resolve(root, decoded);

  // `path.resolve` collapses "..", so this catches anything the checks above
  // missed — including a segment that only becomes traversal after decoding.
  if (target !== root && !target.startsWith(root + path.sep)) return null;

  return target;
}

async function uploadToLocal(input: UploadInput, folder: string): Promise<StoredFile> {
  const root = uploadRoot();
  const dir = path.join(root, folder);
  await mkdir(dir, { recursive: true });

  const target = path.join(dir, input.filename);
  // Defence in depth: refuse anything that resolves outside the upload root.
  if (!target.startsWith(root + path.sep)) {
    throw new AppError("VALIDATION", "That file name is not allowed.");
  }

  await writeFile(target, input.buffer);

  // The URL shape does not depend on where the bytes live, so moving
  // UPLOAD_DIR does not invalidate rows that were stored before the move.
  const url = `/uploads/${folder}/${input.filename}`;
  return { url, key: url, provider: "local" };
}

async function deleteFromLocal(key: string): Promise<void> {
  const relative = key.replace(/^\/?uploads\//, "");
  if (!relative) return;
  const target = resolveUploadPath(relative);
  if (!target) return;
  await unlink(target).catch(() => undefined);
}

/* ──────────────────────── Vercel Blob ──────────────────────── */

const BLOB_API = "https://blob.vercel-storage.com";
const BLOB_API_VERSION = "7";

async function uploadToVercelBlob(input: UploadInput, folder: string): Promise<StoredFile> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new AppError("INTERNAL", "File storage is not configured.");

  const pathname = `${folder}/${input.filename}`;
  const response = await fetch(`${BLOB_API}/${pathname}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": BLOB_API_VERSION,
      "x-content-type": input.mimeType,
      "x-add-random-suffix": "1",
      "cache-control-max-age": "31536000",
    },
    body: new Uint8Array(input.buffer),
  });

  if (!response.ok) {
    logger.error("storage.blob_upload_failed", { status: response.status, pathname });
    throw new AppError("INTERNAL", "The file could not be uploaded. Please try again.");
  }

  const body = (await response.json()) as { url?: string };
  if (!body.url) throw new AppError("INTERNAL", "The file could not be uploaded. Please try again.");
  return { url: body.url, key: body.url, provider: "vercel-blob" };
}

async function deleteFromVercelBlob(key: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  await fetch(`${BLOB_API}/delete`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": BLOB_API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({ urls: [key] }),
  });
}

/* ───────────────────── S3 / R2 (SigV4) ─────────────────────── */

type S3Config = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function s3Config(): S3Config {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || "auto";
  // Cloudflare R2: https://<account>.r2.cloudflarestorage.com
  const endpoint = (process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`).replace(/\/+$/, "");

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new AppError("INTERNAL", "File storage is not configured.");
  }
  return { bucket, region, endpoint, accessKeyId, secretAccessKey };
}

const sha256Hex = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/** Minimal AWS Signature V4 for a single PUT/DELETE against one object. */
function signS3Request(
  cfg: S3Config,
  method: "PUT" | "DELETE",
  objectPath: string,
  payload: Buffer,
  contentType?: string,
): { url: string; headers: Record<string, string> } {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${objectPath}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(payload);

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    method,
    url.pathname.split("/").map(encodeURIComponent).join("/").replace(/%2F/g, "/"),
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp), cfg.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: url.toString(), headers };
}

async function uploadToS3(input: UploadInput, folder: string): Promise<StoredFile> {
  const cfg = s3Config();
  const key = `${folder}/${input.filename}`;
  const { url, headers } = signS3Request(cfg, "PUT", key, input.buffer, input.mimeType);

  const response = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "cache-control": "public, max-age=31536000, immutable" },
    body: new Uint8Array(input.buffer),
  });

  if (!response.ok) {
    logger.error("storage.s3_upload_failed", { status: response.status, key });
    throw new AppError("INTERNAL", "The file could not be uploaded. Please try again.");
  }

  return { url: getFileUrl(key, "s3"), key, provider: "s3" };
}

async function deleteFromS3(key: string): Promise<void> {
  const cfg = s3Config();
  // Accept either a bare key or a full public URL.
  let objectKey = key;
  const publicBase = (process.env.S3_PUBLIC_URL || "").replace(/\/+$/, "");
  if (publicBase && key.startsWith(publicBase)) objectKey = key.slice(publicBase.length + 1);

  const { url, headers } = signS3Request(cfg, "DELETE", objectKey, Buffer.alloc(0));
  await fetch(url, { method: "DELETE", headers });
}
