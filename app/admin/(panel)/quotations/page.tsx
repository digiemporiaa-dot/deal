import { DocumentList } from "@/components/admin/DocumentList";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  return <DocumentList kind="QUOTATION" status={sp.status} q={sp.q} />;
}
