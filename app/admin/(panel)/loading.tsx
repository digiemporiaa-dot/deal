import { TableSkeleton } from "@/components/admin/ui";

/** Shown while any admin page streams in, so navigation never looks stuck. */
export default function AdminLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-admin-muted" />
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
