import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { TestimonialManager } from "@/components/admin/TestimonialManager";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function TestimonialsPage() {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("testimonials:view");

  const [items, packages] = await Promise.all([
    prisma.testimonial.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.travelPackage.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);

  return (
    <div>
      <PageHeader title="Testimonials" description="Manage customer reviews shown on the website" />
      {items.length === 0 && packages.length === 0 ? (
        <EmptyState title="No testimonials yet" description="Add reviews to build trust with visitors." />
      ) : (
        <TestimonialManager
          items={items.map((t) => ({ id: t.id, customerName: t.customerName, rating: t.rating, review: t.review, destination: t.destination, published: t.published }))}
          packages={packages}
        />
      )}
    </div>
  );
}
