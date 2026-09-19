import { PageHeader } from "@/components/admin/ui";
import { DestinationForm } from "@/components/admin/DestinationForm";
import { requirePermission } from "@/lib/guard";

export default async function NewDestinationPage() {
  await requirePermission("destinations:create");

  return (
    <div>
      <PageHeader title="Add Destination" description="Create a new destination" />
      <DestinationForm />
    </div>
  );
}
