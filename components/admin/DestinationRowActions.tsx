"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";
import { deleteDestination, toggleDestinationFlag } from "@/app/admin/(panel)/destinations/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { useToast } from "@/components/admin/Toast";

export function DestinationRowActions({
  id,
  name,
  published,
  featured,
}: {
  id: string;
  name: string;
  published: boolean;
  featured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  const toggle = async (field: "isPublished" | "isFeatured") => {
    setPending(true);
    const result = await toggleDestinationFlag(id, field);
    if (result.ok) {
      toast.success("Updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setPending(false);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => toggle("isFeatured")}
        disabled={pending}
        className={`rounded-md p-2 hover:bg-slate-100 disabled:opacity-50 ${featured ? "text-amber-500" : "text-slate-400"}`}
        title={featured ? "Remove from featured" : "Mark as featured"}
      >
        <Star className={`h-4 w-4 ${featured ? "fill-current" : ""}`} />
      </button>
      <button
        onClick={() => toggle("isPublished")}
        disabled={pending}
        className={`rounded-md p-2 hover:bg-slate-100 disabled:opacity-50 ${published ? "text-emerald-500" : "text-slate-400"}`}
        title={published ? "Unpublish" : "Publish"}
      >
        {published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <Link
        href={`/admin/destinations/${id}/edit`}
        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <ConfirmButton
        onConfirm={() => deleteDestination(id)}
        title={`Delete "${name}"?`}
        description="This cannot be undone. A destination that still has packages cannot be deleted — move or remove them first."
        confirmLabel="Delete destination"
        successMessage="Destination deleted."
        className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        disabled={pending}
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmButton>
    </div>
  );
}
