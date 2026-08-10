import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { PackageForm } from "@/components/admin/PackageForm";

export const dynamic = "force-dynamic";

export default async function NewPackagePage() {
  const [destinations, categories] = await Promise.all([
    prisma.destination.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.packageCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Add Package" description="Create a new travel package" />
      <PackageForm destinations={destinations} categories={categories} />
    </div>
  );
}
