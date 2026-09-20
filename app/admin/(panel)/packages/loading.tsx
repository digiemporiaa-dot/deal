import { ListPageSkeleton } from "@/components/admin/skeletons";

/** Shown while this page's data is fetched on the server. */
export default function Loading() {
  return <ListPageSkeleton filters={4} rows={10} />;
}
