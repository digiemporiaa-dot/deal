"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";
import { deletePackage, togglePackageFlag } from "@/app/admin/(panel)/packages/actions";

export function PackageRowActions({
  id,
  slug,
  published,
  featured,
}: {
  id: string;
  slug: string;
  published: boolean;
  featured: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const toggle = async (field: "published" | "featured") => {
    setPending(true);
    await togglePackageFlag(id, field);
    router.refresh();
    setPending(false);
  };

  const onDelete = async () => {
    if (!confirm("Delete this package? This cannot be undone.")) return;
    setPending(true);
    const res = await deletePackage(id);
    if (!res.ok) {
      alert(res.error);
      setPending(false);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/packages/${slug}`} target="_blank" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="View on site">
        <Eye className="h-4 w-4" />
      </Link>
      <button onClick={() => toggle("featured")} disabled={pending} className={`rounded-md p-2 hover:bg-slate-100 ${featured ? "text-amber-500" : "text-slate-400"}`} title="Toggle featured">
        <Star className={`h-4 w-4 ${featured ? "fill-current" : ""}`} />
      </button>
      <button onClick={() => toggle("published")} disabled={pending} className={`rounded-md p-2 hover:bg-slate-100 ${published ? "text-emerald-500" : "text-slate-400"}`} title={published ? "Unpublish" : "Publish"}>
        {published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <Link href={`/admin/packages/${id}/edit`} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit">
        <Pencil className="h-4 w-4" />
      </Link>
      <button onClick={onDelete} disabled={pending} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
