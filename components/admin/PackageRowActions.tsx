"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";
import { deletePackage, togglePackageFlag } from "@/app/admin/(panel)/packages/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { useToast } from "@/components/admin/Toast";

export function PackageRowActions({
  id,
  name,
  slug,
  published,
  featured,
}: {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  featured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  const toggle = async (field: "published" | "featured") => {
    setPending(true);
    const result = await togglePackageFlag(id, field);
    if (result.ok) {
      toast.success(field === "published" ? (published ? "Unpublished." : "Published.") : "Updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setPending(false);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/packages/${slug}`}
        target="_blank"
        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        title="View on site"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <button
        onClick={() => toggle("featured")}
        disabled={pending}
        className={`rounded-md p-2 hover:bg-slate-100 disabled:opacity-50 ${featured ? "text-amber-500" : "text-slate-400"}`}
        title={featured ? "Remove from featured" : "Mark as featured"}
      >
        <Star className={`h-4 w-4 ${featured ? "fill-current" : ""}`} />
      </button>
      <button
        onClick={() => toggle("published")}
        disabled={pending}
        className={`rounded-md p-2 hover:bg-slate-100 disabled:opacity-50 ${published ? "text-emerald-500" : "text-slate-400"}`}
        title={published ? "Unpublish" : "Publish"}
      >
        {published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <Link
        href={`/admin/packages/${id}/edit`}
        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <ConfirmButton
        onConfirm={() => deletePackage(id)}
        title={`Delete "${name}"?`}
        description="This cannot be undone. If the package has bookings, unpublish it instead so the records stay intact."
        confirmLabel="Delete package"
        successMessage="Package deleted."
        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        disabled={pending}
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmButton>
    </div>
  );
}
