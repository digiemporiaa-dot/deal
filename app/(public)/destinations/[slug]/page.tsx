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
import { JsonLd, breadcrumbLd, faqLd } from "@/components/seo/JsonLd";
import { destinationEnquiryMessage } from "@/lib/whatsapp";
import { parseList } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const dest = await getDestinationBySlug(slug);
  if (!dest) return { title: "Destination not found" };
  return {
    title: dest.seoTitle || dest.name,
    description: dest.seoDescription || dest.shortDescription,
    alternates: { canonical: `/destinations/${dest.slug}` },
    openGraph: {
      title: dest.seoTitle || dest.name,
      description: dest.seoDescription || dest.shortDescription,
      images: dest.coverImage ? [dest.coverImage] : undefined,
    },
  };
}

export default async function DestinationDetail({ params }: Params) {
  const { slug } = await params;
  const [dest, settings] = await Promise.all([getDestinationBySlug(slug), getSettings()]);
  if (!dest) notFound();

  const highlights = parseList(dest.highlights);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", url: siteUrl },
          { name: "Destinations", url: `${siteUrl}/destinations` },
          { name: dest.name, url: `${siteUrl}/destinations/${dest.slug}` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TouristDestination",
          name: dest.name,
          description: dest.shortDescription,
          image: dest.coverImage,
          address: { "@type": "PostalAddress", addressCountry: dest.country },
        }}
      />
      {dest.faqs.length > 0 && <JsonLd data={faqLd(dest.faqs)} />}

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {dest.coverImage && <Image src={dest.coverImage} alt={dest.name} fill priority className="-z-10 object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-900/85 to-slate-900/30" />
        <div className="container-page flex min-h-[55vh] flex-col justify-end py-16 text-white">
          <p className="flex items-center gap-2 text-sm text-white/85">
            <MapPin className="h-4 w-4" /> {dest.country}
            {dest.city ? ` · ${dest.city}` : ""}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{dest.name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/85">{dest.shortDescription}</p>
        </div>
      </section>

      <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="prose-content whitespace-pre-line">{dest.description}</div>

          {highlights.length > 0 && (
            <div className="mt-8">
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
            </div>
          )}

          {dest.bestTimeToVisit && (
            <div className="mt-8 rounded-2xl border border-slate-200 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                <CalendarDays className="h-5 w-5 text-brand-600" /> Best time to visit
              </h3>
              <p className="mt-2 text-slate-600">{dest.bestTimeToVisit}</p>
            </div>
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
            <SectionHeading title={`Packages in ${dest.name}`} />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dest.packages.map((p) => (
                <PackageCard key={p.id} pkg={{ ...p, category: null }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {dest.faqs.length > 0 && (
        <section className="container-page py-14">
          <SectionHeading title="Frequently asked questions" />
          <Faqs items={dest.faqs} />
        </section>
      )}
    </div>
  );
}
