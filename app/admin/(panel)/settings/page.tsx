import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("settings:view");

  const settings = await getSettings();
  return (
    <div>
      <PageHeader title="Website Settings" description="Manage your business info, contact details, pricing and integrations" />
      <SettingsForm initial={settings} />
    </div>
  );
}
