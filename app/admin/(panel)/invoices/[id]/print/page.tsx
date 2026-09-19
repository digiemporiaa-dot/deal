import { DocumentPrint } from "@/components/admin/DocumentPrint";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("documents:view");

  const { id } = await params;
  return <DocumentPrint kind="INVOICE" id={id} />;
}
