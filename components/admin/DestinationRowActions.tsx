"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";
import { deleteDestination, toggleDestinationFlag } from "@/app/admin/(panel)/destinations/actions";

export function DestinationRowActions({ id, published, featured }: { id: string; published: boolean; featured: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const toggle = async (field: "isPublished" | "isFeatured") => {
    setPending(true);
    await toggleDestinationFlag(id, field);
    router.refresh();
    setPending(false);
  };
  const onDelete = async () => {
    if (!confirm("Delete this destination?")) return;
    setPending(true);
    const res = await deleteDestination(id);
    if (!res.ok) { alert(res.error); setPending(false); return; }
    router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => toggle("isFeatured")} disabled={pending} className={`rounded-md p-2 hover:bg-slate-100 ${featured ? "text-amber-500" : "text-slate-400"}`} title="Toggle featured"><Star className={`h-4 w-4 ${featured ? "fill-current" : ""}`} /></button>
      <button onClick={() => toggle("isPublished")} disabled={pending} className={`rounded-md p-2 hover:bg-slate-100 ${published ? "text-emerald-500" : "text-slate-400"}`} title={published ? "Unpublish" : "Publish"}>{published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
      <Link href={`/admin/destinations/${id}/edit`} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="Edit"><Pencil className="h-4 w-4" /></Link>
      <button onClick={onDelete} disabled={pending} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
