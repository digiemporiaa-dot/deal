import { DocumentDetail } from "@/components/admin/DocumentDetail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentDetail kind="QUOTATION" id={id} />;
}
