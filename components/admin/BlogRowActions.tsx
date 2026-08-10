"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { deleteBlog } from "@/app/admin/(panel)/blogs/actions";

export function BlogRowActions({ id, slug, published }: { id: string; slug: string; published: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <div className="flex items-center justify-end gap-1">
      {published && <Link href={`/blog/${slug}`} target="_blank" className="rounded-md p-2 text-slate-400 hover:bg-slate-100"><ExternalLink className="h-4 w-4" /></Link>}
      <Link href={`/admin/blogs/${id}/edit`} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil className="h-4 w-4" /></Link>
      <button
        disabled={pending}
        onClick={async () => { if (confirm("Delete this post?")) { setPending(true); await deleteBlog(id); router.refresh(); } }}
        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
