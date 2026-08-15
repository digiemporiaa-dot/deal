import Link from "next/link";
import { Eye, PencilLine } from "lucide-react";

/** Shown at the top of an unpublished page when an admin previews it. */
export function PreviewBanner({ title, editHref }: { title: string; editHref: string }) {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-2.5">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-amber-900">
          <Eye className="h-4 w-4" />
          Draft preview — &ldquo;{title}&rdquo; is not published yet. Only you can see this.
        </p>
        <Link
          href={editHref}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-900 px-3 text-xs font-semibold text-white hover:bg-amber-800"
        >
          <PencilLine className="h-3.5 w-3.5" /> Back to editor
        </Link>
      </div>
    </div>
  );
}
