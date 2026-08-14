import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  HeartHandshake,
  Headphones,
  BadgeCheck,
  Compass,
  Plane,
  Palmtree,
  Heart,
  Mountain,
  Snowflake,
  Building2,
  Ship,
  Tent,
  Landmark,
  Globe2,
  Users,
  Sparkles,
} from "lucide-react";
import {
  getFeaturedPackages,
  getFeaturedDestinations,
  getTestimonials,
  getBlogPosts,
  getPackageCategories,
} from "@/lib/services/catalog";
import { getSettings } from "@/lib/settings";
import { PackageCard } from "@/components/site/PackageCard";
import { DestinationCard } from "@/components/site/DestinationCard";
import { Testimonials } from "@/components/site/Testimonials";
import { SectionHeading } from "@/components/site/Section";
import { EnquiryButton } from "@/components/enquiry/EnquiryButton";
import { LinkButton } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* Each category gets its own icon, matched by keywords in its name.
   Anything that doesn't match falls back to the plane icon. */
const CATEGORY_ICONS: { match: string[]; Icon: typeof Plane }[] = [
  { match: ["beach", "island", "goa", "maldives", "andaman"], Icon: Palmtree },
  { match: ["honeymoon", "romantic", "couple"], Icon: Heart },
  { match: ["adventure", "trek", "trekking", "hiking", "mountain"], Icon: Mountain },
  { match: ["hill", "snow", "winter", "ski", "manali", "shimla"], Icon: Snowflake },
  { match: ["city", "urban", "metro", "shopping", "dubai"], Icon: Building2 },
  { match: ["cruise", "boat", "backwater", "kerala"], Icon: Ship },
  { match: ["camping", "wildlife", "safari", "jungle", "forest"], Icon: Tent },
  { match: ["heritage", "temple", "pilgrim", "spiritual", "religious", "char dham"], Icon: Landmark },
  { match: ["international", "abroad", "overseas", "europe", "thailand", "bali"], Icon: Globe2 },
  { match: ["family", "group", "friends", "weekend"], Icon: Users },
  { match: ["luxury", "premium", "deluxe", "exclusive"], Icon: Sparkles },
];

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  const found = CATEGORY_ICONS.find((c) => c.match.some((m) => n.includes(m)));
  return found ? found.Icon : Plane;
}

export default async function HomePage() {
  const [packages, destinations, testimonials, posts, categories, settings] = await Promise.all([
    getFeaturedPackages(6),
    getFeaturedDestinations(6),
    getTestimonials(6),
    getBlogPosts(3),
    getPackageCategories(),
    getSettings(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1920&q=80"
          alt="Scenic travel destination"
          fill
          priority
          className="-z-10 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-slate-900/20" />
        <div className="container-page flex min-h-[85vh] flex-col justify-center py-24 text-white">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm backdrop-blur">
            <BadgeCheck className="h-4 w-4" /> Trusted by 10,000+ happy travellers
          </p>
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            {settings.tagline}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white">
            Handcrafted holiday packages, premium stays and effortless planning — all backed by
            round-the-clock expert support.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/packages" size="lg">
              <Compass className="h-5 w-5" /> Explore Packages
            </LinkButton>
            <EnquiryButton label="Plan My Trip" title="Plan My Trip" size="lg" variant="outline" className="bg-white/10 text-white hover:bg-white/20" />
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container-page -mt-10 relative z-10">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, 6).map((c) => {
              const Icon = categoryIcon(c.name);
              return (
                <Link
                  key={c.id}
                  href={`/packages?category=${c.slug}`}
                  className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-colors hover:bg-brand-50"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Destinations */}
      <section className="container-page py-16">
        <SectionHeading
          eyebrow="Where to next"
          title="Popular Destinations"
          subtitle="Explore our most-loved destinations, curated by travel experts."
          href="/destinations"
          linkLabel="View all destinations"
        />
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
          {destinations.map((d) => (
            <DestinationCard key={d.id} destination={d} />
          ))}
        </div>
      </section>

      {/* Featured Packages */}
      <section className="bg-slate-50 py-16">
        <div className="container-page">
          <SectionHeading
            eyebrow="Handpicked"
            title="Featured Holiday Packages"
            subtitle="Best-selling itineraries with unbeatable value."
            href="/packages"
            linkLabel="Browse all packages"
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="container-page py-16">
        <SectionHeading eyebrow="Why Vacationdeal" title="Travel with total confidence" center />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Secure Booking", text: "Encrypted payments and verified partners on every trip." },
            { icon: HeartHandshake, title: "Tailor-made Trips", text: "Every itinerary is customised to your style and budget." },
            { icon: Headphones, title: "24×7 Support", text: "Real humans, ready to help before, during and after travel." },
            { icon: BadgeCheck, title: "Best Price Promise", text: "Premium experiences at genuinely competitive prices." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="bg-slate-50 py-16">
          <div className="container-page">
            <SectionHeading eyebrow="Loved by travellers" title="What our guests say" center />
            <Testimonials items={testimonials} />
          </div>
        </section>
      )}

      {/* Blog */}
      {posts.length > 0 && (
        <section className="container-page py-16">
          <SectionHeading eyebrow="Travel inspiration" title="From our blog" href="/blog" linkLabel="Read the blog" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative aspect-[16/9] bg-slate-100">
                  {post.coverImage && (
                    <Image src={post.coverImage} alt={post.title} fill sizes="33vw" className="object-cover transition-transform group-hover:scale-105" />
                  )}
                </div>
                <div className="p-5">
                  {post.category && <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{post.category.name}</p>}
                  <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold text-slate-900 group-hover:text-brand-700">{post.title}</h3>
                  <p className="mt-2 text-xs text-slate-500">{post.publishedAt ? formatDate(post.publishedAt) : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-600 px-8 py-14 text-center text-white">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold sm:text-4xl">
            Ready to start your next adventure?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white">
            Tell us your dream destination and our experts will craft a personalised plan — free of charge.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <EnquiryButton label="Get a Free Quote" title="Get a Free Quote" size="lg" variant="secondary" />
            <LinkButton href="/packages" size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              Browse Packages
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
