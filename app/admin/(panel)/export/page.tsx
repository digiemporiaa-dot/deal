import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ExportPanel } from "@/components/admin/ExportPanel";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("export:data");

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !["SUPER_ADMIN", "ADMIN"].includes(role)) redirect("/admin/dashboard");

  const members = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Export & Backup"
        description="Download your leads, records and a full backup of everything"
      />
      <ExportPanel members={members} />
    </div>
  );
}
