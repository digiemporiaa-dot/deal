"use client";

import Link from "next/link";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { deletePage } from "@/app/admin/(panel)/pages/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export function PageRowActions({
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
          href={`/${slug}`}
          target="_blank"
          className="rounded-md p-2 text-admin-text-subtle hover:bg-admin-muted"
          title="View on site"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      )}
      <Link
        href={`/admin/pages/${id}/edit`}
        className="rounded-md p-2 text-admin-text-subtle hover:bg-admin-muted hover:text-brand-600"
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <ConfirmButton
        onConfirm={() => deletePage(id)}
        title={`Delete "${title}"?`}
        description="Visitors will get a 404 at this address. If the page is indexed, add a redirect first so the link keeps working."
        confirmLabel="Delete page"
        successMessage="Page deleted."
        className="rounded-md p-2 text-admin-text-subtle hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmButton>
    </div>
  );
}
