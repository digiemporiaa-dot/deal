import { ListPageSkeleton } from "@/components/admin/skeletons";

/** Shown while this page's data is fetched on the server. */
export default function Loading() {
  return <ListPageSkeleton tiles={0} filters={6} rows={10} />;
}
