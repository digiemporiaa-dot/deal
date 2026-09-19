/**
 * Image sniffing from the file's own bytes.
 *
 * An upload's `Content-Type` and filename both come from the client, so
 * neither is evidence of anything. Everything here reads the actual header:
 * that is what decides whether a file is accepted, what extension it is
 * given, and what dimensions are stored (which is what stops the media
 * library causing layout shift).
 */

export type ImageFormat = "jpeg" | "png" | "gif" | "webp" | "avif";

export type ImageMeta = {
  format: ImageFormat;
  mimeType: string;
  extension: string;
  /** Null when the format is understood but the size could not be read. */
  width: number | null;
  height: number | null;
};

export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

export const FORMAT_EXTENSION: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  gif: "gif",
  webp: "webp",
  avif: "avif",
};

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...buf.subarray(offset, offset + length));
}

/** Detect the format from the magic bytes, or null if it is not an image. */
export function detectImageFormat(buf: Uint8Array): ImageFormat | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "gif"; // GIF8
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && ascii(buf, 8, 4) === "WEBP") return "webp";
  // ISO-BMFF: "....ftypavif" / "ftypavis"
  if (buf.length > 12 && ascii(buf, 4, 4) === "ftyp") {
    const brand = ascii(buf, 8, 4);
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
}

function pngSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function gifSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function jpegSize(buf: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 2; // skip SOI

  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1; // resynchronise on padding
      continue;
    }
    const marker = buf[offset + 1]!;
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    // SOF0..SOF15, excluding the DHT/JPG/DAC markers at 0xc4/0xc8/0xcc.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const chunk = ascii(buf, 12, 4);

  if (chunk === "VP8 ") {
    // Lossy: 14-bit width/height after the 3-byte start code.
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    // Lossless: 14 bits each, packed into the 4 bytes after the signature.
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    // Extended: 24-bit canvas size minus one.
    const width = (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16)) + 1;
    const height = (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16)) + 1;
    return { width, height };
  }
  return null;
}

/**
 * Read format and dimensions from an uploaded buffer.
 * Returns null when the bytes are not one of the supported image formats.
 */
export function readImageMeta(buffer: Uint8Array): ImageMeta | null {
  const format = detectImageFormat(buffer);
  if (!format) return null;

  let size: { width: number; height: number } | null = null;
  try {
    if (format === "png") size = pngSize(buffer);
    else if (format === "gif") size = gifSize(buffer);
    else if (format === "jpeg") size = jpegSize(buffer);
    else if (format === "webp") size = webpSize(buffer);
    // AVIF dimensions live deep in the ispe box; left unread rather than guessed.
  } catch {
    size = null;
  }

  const plausible = size && size.width > 0 && size.height > 0 && size.width <= 30000 && size.height <= 30000;

  return {
    format,
    mimeType: FORMAT_MIME[format],
    extension: FORMAT_EXTENSION[format],
    width: plausible ? size!.width : null,
    height: plausible ? size!.height : null,
  };
}

/**
 * Build a safe stored filename.
 *
 * The original name is only used for a short readable prefix: it is stripped
 * of everything but letters, digits and dashes, so "../../etc/passwd" and
 * "shell.php.jpg" both become harmless. The extension always comes from the
 * detected format, never from the name.
 */
export function safeFilename(originalName: string, extension: string): string {
  const base = originalName
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base || "image"}-${stamp}${random}.${extension}`;
}
