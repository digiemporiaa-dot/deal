import { ListPageSkeleton } from "@/components/admin/skeletons";

/**
 * Fallback loading state for admin pages that do not define their own.
 * Routes with a distinctive shape (the dashboard, the lists) supply a
 * closer match in their own loading.tsx.
 */
export default function AdminLoading() {
  return <ListPageSkeleton filters={3} rows={8} />;
}
