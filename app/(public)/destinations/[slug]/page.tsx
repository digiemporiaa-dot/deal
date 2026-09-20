import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, CalendarDays, Sparkles } from "lucide-react";
import { getDestinationBySlug } from "@/lib/services/catalog";
import { getSettings } from "@/lib/settings";
import { PackageCard } from "@/components/site/PackageCard";
import { Faqs } from "@/components/site/Faqs";
import { SectionHeading } from "@/components/site/Section";
import { EnquiryButton } from "@/components/enquiry/EnquiryButton";
import { WhatsAppLink } from "@/components/site/WhatsAppLink";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildMetadata,
  getSeoMeta,
  breadcrumbSchema,
  faqSchema,
  touristDestinationSchema,
  extraSchema,
} from "@/lib/seo";
import { destinationEnquiryMessage } from "@/lib/whatsapp";
import { parseList } from "@/lib/utils";
import { getRelatedDestinations, getRelatedBlogs } from "@/lib/related";
import { RelatedDestinations, RelatedBlogs } from "@/components/site/RelatedContent";
import { Reveal, Stagger, StaggerItem, HoverLift } from "@/components/motion/Reveal";
import { HeroBackdrop, HeroIntro, HeroLine } from "@/components/motion/Hero";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const dest = await getDestinationBySlug(slug);
  if (!dest) return { title: "Destination not found", robots: { index: false, follow: false } };

  const overrides = await getSeoMeta("DESTINATION", dest.id);
  return buildMetadata(
    {
      path: `/destinations/${dest.slug}`,
      title: dest.seoTitle || dest.name,
      description: dest.seoDescription || dest.shortDescription,
      image: dest.coverImage,
      updatedAt: dest.updatedAt,
    },
    overrides,
  );
}

export default async function DestinationDetail({ params }: Params) {
  const { slug } = await params;
  const [dest, settings] = await Promise.all([getDestinationBySlug(slug), getSettings()]);
  if (!dest) notFound();

  const highlights = parseList(dest.highlights);
  const [overrides, relatedDestinations, guides] = await Promise.all([
    getSeoMeta("DESTINATION", dest.id),
    getRelatedDestinations({ destinationId: dest.id, country: dest.country, limit: 4 }),
    getRelatedBlogs({ destinationId: dest.id, limit: 3 }),
  ]);

  return (
    <div>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Destinations", path: "/destinations" },
            { name: dest.name, path: `/destinations/${dest.slug}` },
          ]),
          touristDestinationSchema({
            name: dest.name,
            description: dest.shortDescription,
            path: `/destinations/${dest.slug}`,
            image: dest.coverImage,
            country: dest.country,
            state: dest.state,
            city: dest.city,
          }),
          ...(dest.faqs.length > 0 ? [faqSchema(dest.faqs)!] : []),
          ...extraSchema(overrides?.schemaJson),
        ]}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {dest.coverImage && (
          <HeroBackdrop>
            <Image src={dest.coverImage} alt={dest.name} fill priority className="object-cover" />
          </HeroBackdrop>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-900/85 to-slate-900/30" />
        <HeroIntro className="container-page flex min-h-[55vh] flex-col justify-end py-16 text-white">
          <HeroLine as="p" className="flex items-center gap-2 text-sm text-white/85">
            <MapPin className="h-4 w-4" /> {dest.country}
            {dest.city ? ` · ${dest.city}` : ""}
          </HeroLine>
          <HeroLine as="h1" className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl">{dest.name}</HeroLine>
          <HeroLine as="p" className="mt-3 max-w-2xl text-lg text-white/85">{dest.shortDescription}</HeroLine>
        </HeroIntro>
      </section>

      <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Reveal className="prose-content whitespace-pre-line">{dest.description}</Reveal>

          {highlights.length > 0 && (
            <Reveal className="mt-8">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-brand-600" /> Highlights
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {h}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {dest.bestTimeToVisit && (
            <Reveal className="mt-8 rounded-2xl border border-slate-200 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                <CalendarDays className="h-5 w-5 text-brand-600" /> Best time to visit
              </h3>
              <p className="mt-2 text-slate-600">{dest.bestTimeToVisit}</p>
            </Reveal>
          )}
        </div>

        {/* Sidebar CTA */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Plan a trip to {dest.name}</h3>
            <p className="mt-2 text-sm text-slate-600">
              Get a free, personalised itinerary from our travel experts.
            </p>
            <EnquiryButton
              label="Enquire Now"
              title={`Trip to ${dest.name}`}
              destination={dest.name}
              className="mt-4 w-full"
            />
            <WhatsAppLink
              number={settings.whatsapp}
              message={destinationEnquiryMessage(dest.name)}
              className="mt-3 w-full"
            />
          </div>
        </aside>
      </div>

      {/* Packages */}
      {dest.packages.length > 0 && (
        <section className="bg-slate-50 py-14">
          <div className="container-page">
            <Reveal>
              <SectionHeading title={`Packages in ${dest.name}`} />
            </Reveal>
            <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dest.packages.map((p) => (
                <StaggerItem key={p.id} className="h-full">
                  <HoverLift>
                    <PackageCard pkg={{ ...p, category: null }} />
                  </HoverLift>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* FAQs */}
      {dest.faqs.length > 0 && (
        <section className="container-page py-14">
          <Reveal>
            <SectionHeading title="Frequently asked questions" />
            <Faqs items={dest.faqs} />
          </Reveal>
        </section>
      )}

      <div className="container-page pb-16">
        <RelatedBlogs
          posts={guides}
          title={`${dest.name} travel guides`}
          subtitle="Tips and itineraries from our team"
        />
        <RelatedDestinations
          destinations={relatedDestinations}
          title="Related destinations"
          subtitle={`Other places to explore in ${dest.country} and beyond`}
        />
      </div>
    </div>
  );
}
