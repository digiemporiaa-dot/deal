import { PageHeader } from "@/components/admin/ui";
import { PageForm } from "@/components/admin/PageForm";

export const dynamic = "force-dynamic";

export default function NewPagePage() {
  return (
    <div>
      <PageHeader title="New Page" description="Create a website page" />
      <PageForm />
    </div>
  );
}
