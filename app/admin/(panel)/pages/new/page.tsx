import { PageHeader } from "@/components/admin/ui";
import { PageForm } from "@/components/admin/PageForm";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function NewPagePage() {
  await requirePermission("pages:create");

  return (
    <div>
      <PageHeader title="New Page" description="Create a website page" />
      <PageForm />
    </div>
  );
}
