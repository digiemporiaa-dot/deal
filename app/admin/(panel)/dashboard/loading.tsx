import { DashboardSkeleton } from "@/components/admin/skeletons";

/** Shown while this page's data is fetched on the server. */
export default function Loading() {
  return <DashboardSkeleton />;
}
