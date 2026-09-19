import { DocumentList } from "@/components/admin/DocumentList";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("documents:view");

  const sp = await searchParams;
  return <DocumentList kind="QUOTATION" status={sp.status} q={sp.q} />;
}
