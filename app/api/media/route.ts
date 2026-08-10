import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** Upload an image to /public/uploads and record it in the Media library. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Unsupported file type. Use JPG, PNG, WEBP, GIF or AVIF." }, { status: 415 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "File too large (max 5MB)." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  const url = `/uploads/${filename}`;
  const media = await prisma.media.create({
    data: { url, filename: file.name, mimeType: file.type, size: file.size },
  });

  return NextResponse.json({ ok: true, media });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const media = await prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ ok: true, media });
}
