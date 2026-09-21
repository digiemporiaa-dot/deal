import { describe, it, expect, vi, afterEach } from "vitest";
import { __testing } from "@/lib/fetch-image";

const { isBlockedAddress } = __testing;

/**
 * The address filter is the whole of the SSRF defence, so it is tested
 * directly rather than through a network call.
 */
describe("remote image address filter", () => {
  describe("blocks addresses that reach inside the network", () => {
    const blocked = [
      ["loopback", "127.0.0.1"],
      ["loopback, other octet", "127.1.2.3"],
      ["private 10/8", "10.0.0.1"],
      ["private 172.16/12, low", "172.16.0.1"],
      ["private 172.16/12, high", "172.31.255.254"],
      ["private 192.168/16", "192.168.1.1"],
      ["cloud metadata", "169.254.169.254"],
      ["link-local", "169.254.1.1"],
      ["this network", "0.0.0.0"],
      ["carrier-grade NAT", "100.64.0.1"],
      ["multicast", "224.0.0.1"],
      ["reserved", "255.255.255.255"],
      ["IPv6 loopback", "::1"],
      ["IPv6 unspecified", "::"],
      ["IPv6 link-local", "fe80::1"],
      ["IPv6 unique-local", "fd00::1"],
      ["IPv6 unique-local, fc", "fc00::1"],
      ["IPv6 multicast", "ff02::1"],
      ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
      ["IPv4-mapped private", "::ffff:10.0.0.1"],
    ] as const;

    for (const [label, address] of blocked) {
      it(label, () => expect(isBlockedAddress(address)).toBe(true));
    }
  });

  describe("allows ordinary public addresses", () => {
    const allowed = [
      ["a public host", "151.101.1.140"],
      ["just outside 172.16/12, below", "172.15.0.1"],
      ["just outside 172.16/12, above", "172.32.0.1"],
      ["not 192.168", "192.169.0.1"],
      ["not 169.254", "169.253.0.1"],
      ["just outside CGNAT", "100.128.0.1"],
      ["a public IPv6 address", "2606:4700:4700::1111"],
    ] as const;

    for (const [label, address] of allowed) {
      it(label, () => expect(isBlockedAddress(address)).toBe(false));
    }
  });

  it("refuses anything that is not an address at all", () => {
    // Reaching this with a non-address means the lookup returned something
    // unexpected; refusing is the only safe answer.
    expect(isBlockedAddress("not-an-address")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});

/**
 * The download itself. The network and DNS are both mocked, because the point
 * is the logic around the request — the size cap, the redirect refusal, the
 * empty-body case — not whether fetch works.
 */
describe("fetchRemoteImage", () => {
  const realFetch = globalThis.fetch;

  function mockResponse(body: Uint8Array | null, init: Partial<{ status: number; headers: Record<string, string> }> = {}) {
    const status = init.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (k: string) => (init.headers || {})[k.toLowerCase()] ?? null },
      body: body
        ? {
            getReader() {
              let sent = false;
              return {
                read: async () => (sent ? { done: true, value: undefined } : ((sent = true), { done: false, value: body })),
                cancel: async () => {},
              };
            },
          }
        : null,
    } as unknown as Response;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("returns the bytes and a filename taken from the path", async () => {
    globalThis.fetch = vi.fn(async () => mockResponse(new Uint8Array([1, 2, 3, 4]))) as typeof fetch;
    const { fetchRemoteImage } = await import("@/lib/fetch-image");
    const result = await fetchRemoteImage("https://example.com/photos/beach.jpg", 1000);
    expect(Array.from(result.buffer)).toEqual([1, 2, 3, 4]);
    expect(result.filename).toBe("beach.jpg");
  });

  it("refuses a redirect rather than following it somewhere internal", async () => {
    globalThis.fetch = vi.fn(async () => mockResponse(null, { status: 302 })) as typeof fetch;
    const { fetchRemoteImage } = await import("@/lib/fetch-image");
    await expect(fetchRemoteImage("https://example.com/a.jpg", 1000)).rejects.toThrow(/redirects/i);
  });

  it("stops a body that goes past the cap, whatever Content-Length claimed", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockResponse(new Uint8Array(500), { headers: { "content-length": "10" } }),
    ) as typeof fetch;
    const { fetchRemoteImage } = await import("@/lib/fetch-image");
    await expect(fetchRemoteImage("https://example.com/a.jpg", 100)).rejects.toThrow(/too large/i);
  });

  it("rejects a Content-Length that is over the cap up front", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockResponse(new Uint8Array(1), { headers: { "content-length": "999999" } }),
    ) as typeof fetch;
    const { fetchRemoteImage } = await import("@/lib/fetch-image");
    await expect(fetchRemoteImage("https://example.com/a.jpg", 100)).rejects.toThrow(/too large/i);
  });

  it("rejects an empty body", async () => {
    globalThis.fetch = vi.fn(async () => mockResponse(new Uint8Array(0))) as typeof fetch;
    const { fetchRemoteImage } = await import("@/lib/fetch-image");
    await expect(fetchRemoteImage("https://example.com/a.jpg", 100)).rejects.toThrow(/empty/i);
  });

  it("rejects a non-http scheme before it does any lookup", async () => {
    const { fetchRemoteImage } = await import("@/lib/fetch-image");
    await expect(fetchRemoteImage("file:///etc/passwd", 100)).rejects.toThrow(/http and https/i);
  });

  it("rejects a hostname that resolves to a private address", async () => {
    const { fetchRemoteImage } = await import("@/lib/fetch-image");
    // "localtest.me" style: a public name pointing at 127.0.0.1 is the
    // standard way past a check that only reads the hostname text.
    await expect(fetchRemoteImage("http://127.0.0.1/a.jpg", 100)).rejects.toThrow(/not allowed/i);
  });
});
