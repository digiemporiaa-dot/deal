import { prisma } from "@/lib/db";
import { requirePermission, can } from "@/lib/guard";
import { PageHeader } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/MediaLibrary";

export const dynamic = "force-dynamic";

const PER_PAGE = 48;

export default async function MediaPage() {
  // The page enforces its own permission — the middleware is not the only gate.
  await requirePermission("media:view");

  const [media, total, folders, canUpload, canEdit, canDelete] = await Promise.all([
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: PER_PAGE }),
    prisma.media.count(),
    prisma.media.groupBy({ by: ["folder"], _count: { _all: true } }),
    can("media:upload"),
    can("media:update"),
    can("media:delete"),
  ]);

  const missingAlt = await prisma.media.count({ where: { OR: [{ alt: null }, { alt: "" }] } });

  return (
    <div>
      <PageHeader
        title="Media Library"
        description="Upload and manage images. Copy a URL to use it anywhere on the site."
      />

      {missingAlt > 0 && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {missingAlt} image{missingAlt === 1 ? " has" : "s have"} no alt text. Adding it helps those
          images rank in image search and makes the site usable with a screen reader.
        </p>
      )}

      <MediaLibrary
        initial={media.map((m) => ({
          id: m.id,
          url: m.url,
          filename: m.filename,
          originalFilename: m.originalFilename,
          mimeType: m.mimeType,
          size: m.size,
          width: m.width,
          height: m.height,
          alt: m.alt,
          title: m.title,
          caption: m.caption,
          folder: m.folder,
          createdAt: m.createdAt.toISOString(),
        }))}
        initialFolders={folders
          .map((f) => ({ folder: f.folder, count: f._count._all }))
          .sort((a, b) => a.folder.localeCompare(b.folder))}
        initialTotal={total}
        perPage={PER_PAGE}
        canUpload={canUpload}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
