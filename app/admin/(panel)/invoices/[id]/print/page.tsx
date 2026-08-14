import { DocumentPrint } from "@/components/admin/DocumentPrint";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentPrint kind="INVOICE" id={id} />;
}
