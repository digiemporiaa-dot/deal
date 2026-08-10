import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  // Remove the local file if it lives under /public/uploads.
  if (media.url.startsWith("/uploads/")) {
    try {
      await unlink(path.join(process.cwd(), "public", media.url));
    } catch {
      // File may already be gone — ignore.
    }
  }
  await prisma.media.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
