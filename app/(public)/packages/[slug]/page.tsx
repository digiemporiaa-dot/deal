import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Users, Check, X, Star, BedDouble } from "lucide-react";
import { getPackageBySlug } from "@/lib/services/catalog";
import { getSettings } from "@/lib/settings";
import { formatCurrency, toNumber, parseList } from "@/lib/utils";
import { ItineraryTimeline } from "@/components/site/ItineraryTimeline";
import { Gallery } from "@/components/site/Gallery";
import { Faqs } from "@/components/site/Faqs";
import { EnquiryButton } from "@/components/enquiry/EnquiryButton";
import { WhatsAppLink } from "@/components/site/WhatsAppLink";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { JsonLd, breadcrumbLd, faqLd } from "@/components/seo/JsonLd";
import { packageEnquiryMessage } from "@/lib/whatsapp";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) return { title: "Package not found" };
  return {
    title: pkg.seoTitle || pkg.name,
    description: pkg.seoDescription || pkg.shortDescription,
    alternates: { canonical: `/packages/${pkg.slug}` },
    openGraph: {
      title: pkg.seoTitle || pkg.name,
      description: pkg.seoDescription || pkg.shortDescription,
      images: pkg.images[0]?.url ? [pkg.images[0].url] : undefined,
    },
  };
}

export default async function PackageDetail({ params }: Params) {
  const { slug } = await params;
  const [pkg, settings] = await Promise.all([getPackageBySlug(slug), getSettings()]);
  if (!pkg) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const highlights = parseList(pkg.highlights);
  const price = pkg.discountPrice != null ? toNumber(pkg.discountPrice) : toNumber(pkg.startingPrice);
  const hasDiscount = pkg.discountPrice != null;
  const avgRating =
    pkg.reviews.length > 0
      ? pkg.reviews.reduce((a, r) => a + r.rating, 0) / pkg.reviews.length
      : null;

  return (
    <div className="container-page py-10">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", url: siteUrl },
          { name: "Packages", url: `${siteUrl}/packages` },
          { name: pkg.name, url: `${siteUrl}/packages/${pkg.slug}` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: pkg.name,
          description: pkg.shortDescription,
          image: pkg.images.map((i) => i.url),
          offers: {
            "@type": "Offer",
            price,
            priceCurrency: pkg.currency,
            availability: "https://schema.org/InStock",
          },
        }}
      />
      {pkg.faqs.length > 0 && <JsonLd data={faqLd(pkg.faqs)} />}

      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand-600">Home</Link> ·{" "}
        <Link href="/packages" className="hover:text-brand-600">Packages</Link> ·{" "}
        <span className="text-slate-700">{pkg.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {pkg.category && <Badge tone="brand">{pkg.category.name}</Badge>}
            {pkg.featured && <Badge tone="amber"><Star className="mr-1 h-3 w-3 fill-current" />Featured</Badge>}
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">{pkg.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-brand-600" />
              <Link href={`/destinations/${pkg.destination.slug}`} className="hover:text-brand-600">
                {pkg.destination.name}, {pkg.destination.country}
              </Link>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-brand-600" /> {pkg.durationDays} Days / {pkg.durationNights} Nights
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand-600" /> {pkg.minTravellers}–{pkg.maxTravellers} travellers
            </span>
            {avgRating && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {avgRating.toFixed(1)} ({pkg.reviews.length})
              </span>
            )}
          </div>
        </div>
      </div>

      <Gallery images={pkg.images} title={pkg.name} />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          {/* Overview */}
          <section>
            <h2 className="mb-3 text-2xl font-bold text-slate-900">Overview</h2>
            <div className="prose-content whitespace-pre-line">{pkg.description}</div>
          </section>

          {/* Highlights */}
          {highlights.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Highlights</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Itinerary */}
          {pkg.itinerary.length > 0 && (
            <section>
              <h2 className="mb-5 text-2xl font-bold text-slate-900">Day-by-day itinerary</h2>
              <ItineraryTimeline days={pkg.itinerary} />
            </section>
          )}

          {/* Hotels */}
          {pkg.hotels.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Hotels</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pkg.hotels.map((h) => (
                  <div key={h.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-5 w-5 text-brand-600" />
                      <h3 className="font-semibold text-slate-900">{h.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {[h.location, h.roomType, `${h.nights} night(s)`].filter(Boolean).join(" · ")}
                    </p>
                    {h.description && <p className="mt-2 text-sm text-slate-600">{h.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Inclusions / Exclusions */}
          {(pkg.inclusions.length > 0 || pkg.exclusions.length > 0) && (
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {pkg.inclusions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-slate-900">What&apos;s included</h3>
                  <ul className="space-y-2">
                    {pkg.inclusions.map((i) => (
                      <li key={i.id} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {i.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pkg.exclusions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-slate-900">What&apos;s not included</h3>
                  <ul className="space-y-2">
                    {pkg.exclusions.map((i) => (
                      <li key={i.id} className="flex items-start gap-2 text-sm text-slate-700">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /> {i.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Reviews */}
          {pkg.reviews.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Traveller reviews</h2>
              <div className="space-y-4">
                {pkg.reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={i < r.rating ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-slate-300"} />
                      ))}
                    </div>
                    <p className="mt-2 text-slate-700">&ldquo;{r.review}&rdquo;</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{r.customerName}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FAQs */}
          {pkg.faqs.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Frequently asked questions</h2>
              <Faqs items={pkg.faqs} />
            </section>
          )}
        </div>

        {/* Booking sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-sm text-slate-500">Starting from</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{formatCurrency(price, pkg.currency)}</span>
              {hasDiscount && (
                <span className="text-slate-400 line-through">{formatCurrency(toNumber(pkg.startingPrice), pkg.currency)}</span>
              )}
            </div>
            <p className="text-xs text-slate-500">per person</p>

            {pkg.bookingEnabled ? (
              <LinkButton href={`/packages/${pkg.slug}/book`} size="lg" className="mt-5 w-full">
                Book Now
              </LinkButton>
            ) : (
              <p className="mt-5 rounded-lg bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
                Online booking unavailable — enquire for details.
              </p>
            )}
            <EnquiryButton
              label="Enquire Now"
              title={pkg.name}
              destination={pkg.destination.name}
              variant="outline"
              className="mt-3 w-full"
            />
            <WhatsAppLink number={settings.whatsapp} message={packageEnquiryMessage(pkg.name)} className="mt-3 w-full" />

            <ul className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Free customisation</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> {settings.advancePercent}% advance to confirm</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> 24×7 on-trip support</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
