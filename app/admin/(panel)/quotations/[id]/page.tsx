import { DocumentDetail } from "@/components/admin/DocumentDetail";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("documents:view");

  const { id } = await params;
  return <DocumentDetail kind="QUOTATION" id={id} />;
}
