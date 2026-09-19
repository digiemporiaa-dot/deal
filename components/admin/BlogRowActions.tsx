"use client";

import Link from "next/link";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { deleteBlog } from "@/app/admin/(panel)/blogs/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export function BlogRowActions({
  id,
  title,
  slug,
  published,
}: {
  id: string;
  title: string;
  slug: string;
  published: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {published && (
        <Link
          href={`/blog/${slug}`}
          target="_blank"
          className="rounded-md p-2 text-slate-400 hover:bg-slate-100"
          title="View on site"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      )}
      <Link
        href={`/admin/blogs/${id}/edit`}
        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <ConfirmButton
        onConfirm={() => deleteBlog(id)}
        title={`Delete "${title}"?`}
        description="This cannot be undone. If the post is already indexed by Google, consider unpublishing it and adding a redirect instead."
        confirmLabel="Delete post"
        successMessage="Post deleted."
        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmButton>
    </div>
  );
}
