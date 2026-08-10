import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const media = await prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div>
      <PageHeader title="Media Library" description="Upload and manage images. Copy a URL to use it anywhere." />
      <MediaLibrary initial={media.map((m) => ({ id: m.id, url: m.url, filename: m.filename, size: m.size }))} />
    </div>
  );
}
