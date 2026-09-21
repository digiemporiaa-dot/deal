import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { invalid } from "@/lib/errors";

/**
 * Fetch a remote image so it can be stored on this server.
 *
 * This takes a URL an admin typed and asks *our* server to open it, which is
 * a server-side request forgery risk: the target is chosen by the caller, the
 * request comes from inside the network, and on a cloud host the metadata
 * service is usually one unauthenticated GET away from credentials.
 *
 * So the address is checked rather than trusted:
 *
 *  - http and https only. No file:, gopher:, data: or anything else a URL
 *    parser will happily accept.
 *  - The hostname is resolved and every address it maps to is checked against
 *    the private, loopback, link-local and unique-local ranges, plus the
 *    169.254.169.254 metadata address. A public name that resolves to
 *    127.0.0.1 is the standard way round a string-matching check, so the
 *    check is on the resolved addresses, not on the text of the hostname.
 *  - Redirects are not followed. A permitted URL that redirects to an
 *    internal one would otherwise walk straight past the check above; the
 *    caller is told to use the final URL instead.
 *  - The response is capped and timed out, so a hostile or merely broken
 *    server cannot exhaust memory or hold a request open.
 *
 * What comes back is bytes. The caller still has to decide whether they are
 * really an image — that is `readImageMeta`'s job, from the magic bytes.
 */

const TIMEOUT_MS = 10_000;

/** Addresses that must never be reachable from a user-supplied URL. */
function isBlockedAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts as [number, number, number, number];
    if (a === 0) return true;                        // "this network"
    if (a === 10) return true;                       // private
    if (a === 127) return true;                      // loopback
    if (a === 169 && b === 254) return true;         // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true;         // private
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true;                       // multicast and reserved
    return false;
  }

  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;        // unspecified, loopback
    if (lower.startsWith("fe80")) return true;                 // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    if (lower.startsWith("ff")) return true;                   // multicast
    // An IPv4 address wearing an IPv6 hat.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]!);
    return false;
  }

  // Not an address we can reason about — refuse rather than guess.
  return true;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // A bare address needs no lookup; a name needs every answer checked,
  // because one private result is enough to reach inside.
  const addresses = isIP(hostname)
    ? [hostname]
    : (await lookup(hostname, { all: true }).catch(() => [])).map((entry) => entry.address);

  if (addresses.length === 0) {
    throw invalid("That address could not be resolved.");
  }
  if (addresses.some(isBlockedAddress)) {
    throw invalid("That address is not allowed. Use a public image URL.");
  }
}

export type FetchedImage = { buffer: Buffer; filename: string };

export async function fetchRemoteImage(rawUrl: string, maxBytes: number): Promise<FetchedImage> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw invalid("That is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw invalid("Only http and https URLs can be imported.");
  }

  await assertPublicHost(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
  } catch {
    throw invalid("That image could not be downloaded.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    throw invalid("That URL redirects elsewhere. Use the address it points to.");
  }
  if (!response.ok || !response.body) {
    throw invalid(`That image could not be downloaded (HTTP ${response.status}).`);
  }

  // A Content-Length is a hint, not a promise, so the stream is counted as it
  // arrives and abandoned the moment it goes over.
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    throw invalid("That image is too large.");
  }

  const chunks: Buffer[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw invalid("That image is too large.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  if (total === 0) {
    throw invalid("That URL returned an empty file.");
  }

  const name = decodeURIComponent(url.pathname.split("/").pop() || "").trim();
  return { buffer: Buffer.concat(chunks), filename: name || "image" };
}

export const __testing = { isBlockedAddress };
