import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { AppearanceForm } from "@/components/admin/AppearanceForm";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("settings:view");

  const settings = await getSettings();
  return (
    <div>
      <PageHeader
        title="Appearance"
        description="Control how the public website looks — logo, colours, fonts and button shape"
      />
      <AppearanceForm
        initial={settings.theme}
        logoUrl={settings.logoUrl}
        faviconUrl={settings.faviconUrl}
      />
    </div>
  );
}
