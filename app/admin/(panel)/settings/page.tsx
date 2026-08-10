import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div>
      <PageHeader title="Website Settings" description="Manage your business info, contact details, pricing and integrations" />
      <SettingsForm initial={settings} />
    </div>
  );
}
