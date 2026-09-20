import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getPackages, getPackageCategories, getPublishedDestinations } from "@/lib/services/catalog";
import { PackageCard } from "@/components/site/PackageCard";
import { SectionHeading } from "@/components/site/Section";
import { PackageFiltersBar } from "@/components/site/PackageFiltersBar";
import { Reveal, Stagger, StaggerItem, HoverLift } from "@/components/motion/Reveal";

/**
 * Filtered, sorted and searched variants of this listing are the classic
 * source of duplicate content: they all show slices of the same catalogue.
 * They stay crawlable for discovery but are marked noindex, and every one of
 * them canonicalises to the clean /packages URL.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = ["q", "destination", "category", "minPrice", "maxPrice", "duration", "sort", "page"].some(
    (key) => Boolean(sp[key]),
  );

  return buildMetadata({
    path: "/packages",
    title: "Holiday Packages",
    description: "Browse and book handcrafted holiday packages with the best prices.",
    noIndex: filtered,
  });
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [packages, categories, destinations] = await Promise.all([
    getPackages({
      q: sp.q,
      destination: sp.destination,
      category: sp.category,
      duration: sp.duration,
      sort: sp.sort,
      minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
      maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    }),
    getPackageCategories(),
    getPublishedDestinations(),
  ]);

  return (
    <div className="container-page py-14">
      <Reveal>
        <SectionHeading
          eyebrow="Find your trip"
          title="Holiday Packages"
          subtitle="Search, filter and book the perfect getaway."
        />
      </Reveal>

      <PackageFiltersBar
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        destinations={destinations.map((d) => ({ slug: d.slug, name: d.name }))}
        initial={sp}
      />

      <p className="mb-5 mt-6 text-sm text-slate-500">{packages.length} package(s) found</p>

      {packages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No packages match your filters. Try broadening your search.
        </p>
      ) : (
        <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <StaggerItem key={p.id} className="h-full">
              <HoverLift>
                <PackageCard pkg={p} />
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
