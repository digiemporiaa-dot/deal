import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { uploadRoot, uploadsArePublic, resolveUploadPath, storageDriver } from "@/lib/storage";

/**
 * The upload directory is reachable by request path, so everything that
 * resolves one is a path-traversal surface. These tests drive it with what an
 * attacker would send, not with what the app sends.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.UPLOAD_DIR;
  delete process.env.STORAGE_DRIVER;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.S3_BUCKET;
  delete process.env.S3_ACCESS_KEY_ID;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("storageDriver", () => {
  it("defaults to local, which is what a VPS wants", () => {
    expect(storageDriver()).toBe("local");
  });

  it("honours an explicit driver", () => {
    process.env.STORAGE_DRIVER = "s3";
    expect(storageDriver()).toBe("s3");
    process.env.STORAGE_DRIVER = "LOCAL";
    expect(storageDriver()).toBe("local");
  });

  it("infers a driver from credentials, so an existing deployment keeps working", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    expect(storageDriver()).toBe("vercel-blob");
  });

  it("an explicit local setting beats inferred credentials", () => {
    // Someone moving off Vercel Blob onto their own disk sets the driver but
    // may not have removed the old token yet.
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    process.env.STORAGE_DRIVER = "local";
    expect(storageDriver()).toBe("local");
  });

  it("ignores a driver name it does not recognise", () => {
    process.env.STORAGE_DRIVER = "dropbox";
    expect(storageDriver()).toBe("local");
  });
});

describe("uploadRoot", () => {
  it("defaults to public/uploads inside the app", () => {
    expect(uploadRoot()).toBe(path.join(process.cwd(), "public", "uploads"));
    expect(uploadsArePublic()).toBe(true);
  });

  it("uses UPLOAD_DIR when set, and reports it as not public", () => {
    process.env.UPLOAD_DIR = "/var/www/vacationdeal-uploads";
    expect(uploadRoot()).toBe("/var/www/vacationdeal-uploads");
    expect(uploadsArePublic()).toBe(false);
  });

  it("resolves a relative UPLOAD_DIR against the working directory", () => {
    process.env.UPLOAD_DIR = "storage/media";
    expect(uploadRoot()).toBe(path.join(process.cwd(), "storage", "media"));
  });

  it("treats whitespace as unset rather than as a path", () => {
    process.env.UPLOAD_DIR = "   ";
    expect(uploadRoot()).toBe(path.join(process.cwd(), "public", "uploads"));
  });

  it("still counts as public when UPLOAD_DIR points inside public/", () => {
    process.env.UPLOAD_DIR = path.join(process.cwd(), "public", "media");
    expect(uploadsArePublic()).toBe(true);
  });

  it("does not mistake a sibling of public/ for being inside it", () => {
    process.env.UPLOAD_DIR = `${path.join(process.cwd(), "public")}-uploads`;
    expect(uploadsArePublic()).toBe(false);
  });
});

describe("resolveUploadPath", () => {
  const root = "/var/uploads";

  beforeEach(() => {
    process.env.UPLOAD_DIR = root;
  });

  it("resolves an ordinary file", () => {
    expect(resolveUploadPath("packages/photo-x1y2.jpg")).toBe(`${root}/packages/photo-x1y2.jpg`);
  });

  it("refuses traversal out of the root", () => {
    expect(resolveUploadPath("../etc/passwd")).toBeNull();
    expect(resolveUploadPath("packages/../../etc/passwd")).toBeNull();
    expect(resolveUploadPath("a/b/c/../../../../etc/passwd")).toBeNull();
  });

  it("refuses percent-encoded traversal", () => {
    // What actually arrives on the wire when someone probes.
    expect(resolveUploadPath("%2e%2e/etc/passwd")).toBeNull();
    expect(resolveUploadPath("packages/%2e%2e%2f%2e%2e%2fetc/passwd")).toBeNull();
  });

  it("refuses an absolute path", () => {
    expect(resolveUploadPath("/etc/passwd")).toBeNull();
    expect(resolveUploadPath("C:/windows/win.ini")).toBeNull();
  });

  it("refuses backslashes, which are separators on some filesystems", () => {
    expect(resolveUploadPath("..\\etc\\passwd")).toBeNull();
    expect(resolveUploadPath("packages\\photo.jpg")).toBeNull();
  });

  it("refuses a NUL byte, which can truncate a path in a C library", () => {
    expect(resolveUploadPath("photo.jpg\u0000.txt")).toBeNull();
  });

  it("refuses dotfiles at any depth", () => {
    expect(resolveUploadPath(".env")).toBeNull();
    expect(resolveUploadPath("packages/.env")).toBeNull();
    expect(resolveUploadPath(".ssh/id_rsa")).toBeNull();
  });

  it("refuses a malformed escape rather than throwing", () => {
    expect(resolveUploadPath("%")).toBeNull();
    expect(resolveUploadPath("%zz")).toBeNull();
  });

  it("does not escape via a prefix that merely starts with the root", () => {
    // "/var/uploads-evil" starts with "/var/uploads" as a string, but is a
    // different directory.
    expect(resolveUploadPath("../uploads-evil/secret.jpg")).toBeNull();
  });

  it("allows a nested folder, which is how the library organises files", () => {
    expect(resolveUploadPath("destinations/kashmir/cover-a1b2.webp")).toBe(
      `${root}/destinations/kashmir/cover-a1b2.webp`,
    );
  });
});
