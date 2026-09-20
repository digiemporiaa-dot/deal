import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getPublishedDestinations } from "@/lib/services/catalog";
import { DestinationCard } from "@/components/site/DestinationCard";
import { SectionHeading } from "@/components/site/Section";
import { Reveal, Stagger, StaggerItem, HoverLift } from "@/components/motion/Reveal";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; featured?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  // Country and "featured" views are slices of the same list — one canonical.
  const filtered = Boolean(sp.country || sp.featured);

  return buildMetadata({
    path: "/destinations",
    title: "Destinations",
    description: "Browse our handpicked travel destinations around the world.",
    noIndex: filtered,
  });
}

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; featured?: string }>;
}) {
  const params = await searchParams;
  const destinations = await getPublishedDestinations({
    country: params.country,
    featured: params.featured === "1",
  });
  const countries = Array.from(new Set(destinations.map((d) => d.country))).sort();

  return (
    <div className="container-page py-14">
      <Reveal>
        <SectionHeading
          eyebrow="Explore the world"
          title="Our Destinations"
          subtitle="From tropical beaches to alpine peaks — find the perfect place for your next escape."
        />
      </Reveal>

      {/* Filters */}
      <Reveal className="mb-8 flex flex-wrap gap-2" delay={0.08}>
        <FilterLink href="/destinations" active={!params.country && params.featured !== "1"}>
          All
        </FilterLink>
        <FilterLink href="/destinations?featured=1" active={params.featured === "1"}>
          Popular
        </FilterLink>
        {countries.map((c) => (
          <FilterLink key={c} href={`/destinations?country=${encodeURIComponent(c)}`} active={params.country === c}>
            {c}
          </FilterLink>
        ))}
      </Reveal>

      {destinations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No destinations found.
        </p>
      ) : (
        <Stagger className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {destinations.map((d) => (
            <StaggerItem key={d.id}>
              <HoverLift lift={3}>
                <DestinationCard destination={d} />
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={
        active
          ? "rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          : "rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      }
    >
      {children}
    </a>
  );
}
