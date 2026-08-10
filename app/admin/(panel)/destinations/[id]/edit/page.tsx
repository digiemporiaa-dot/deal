import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { DestinationForm } from "@/components/admin/DestinationForm";
import { parseList } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditDestinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.destination.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } }, faqs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!d) notFound();

  const initial = {
    name: d.name, slug: d.slug, country: d.country, state: d.state ?? "", city: d.city ?? "",
    shortDescription: d.shortDescription, description: d.description, coverImage: d.coverImage ?? "",
    bestTimeToVisit: d.bestTimeToVisit ?? "", travelInformation: d.travelInformation ?? "",
    isFeatured: d.isFeatured, isPublished: d.isPublished, seoTitle: d.seoTitle ?? "", seoDescription: d.seoDescription ?? "",
    highlights: parseList(d.highlights).length ? parseList(d.highlights).map((value) => ({ value })) : [{ value: "" }],
    images: d.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
    faqs: d.faqs.map((f) => ({ question: f.question, answer: f.answer })),
  };

  return (
    <div>
      <PageHeader title="Edit Destination" description={d.name} />
      <DestinationForm initial={initial} destinationId={d.id} />
    </div>
  );
}
