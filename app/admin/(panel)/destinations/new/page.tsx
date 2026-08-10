import { PageHeader } from "@/components/admin/ui";
import { DestinationForm } from "@/components/admin/DestinationForm";

export default function NewDestinationPage() {
  return (
    <div>
      <PageHeader title="Add Destination" description="Create a new destination" />
      <DestinationForm />
    </div>
  );
}
