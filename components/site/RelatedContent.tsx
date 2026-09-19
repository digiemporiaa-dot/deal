import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, CalendarDays } from "lucide-react";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import type { RelatedBlog, RelatedDestination, RelatedPackage } from "@/lib/related";

/**
 * Internal linking blocks.
 *
 * Server components with no client JavaScript: every recommendation is a real
 * anchor, which is what makes these sections worth anything to a crawler.
 * Each renders nothing at all when there is nothing genuinely related, so a
 * page never shows an empty "you may also like" heading.
 */

function SectionShell({
  title,
  subtitle,
  moreHref,
  moreLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  moreHref?: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {moreHref && (
          <Link
            href={moreHref}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            {moreLabel ?? "View all"} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function RelatedPackages({
  packages,
  title = "You may also like",
  subtitle,
  moreHref = "/packages",
}: {
  packages: RelatedPackage[];
  title?: string;
  subtitle?: string;
  moreHref?: string;
}) {
  if (packages.length === 0) return null;

  return (
    <SectionShell title={title} subtitle={subtitle} moreHref={moreHref} moreLabel="All packages">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => {
          const price = toNumber(pkg.discountPrice ?? pkg.startingPrice);
          const cover = pkg.images[0];
          return (
            <Link
              key={pkg.id}
              href={`/packages/${pkg.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                {cover && (
                  <Image
                    src={cover.url}
                    // Alt text falls back to the package name so the link is
                    // never announced as an unlabelled image.
                    alt={cover.alt || pkg.name}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {pkg.destination && (
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" /> {pkg.destination.name}
                  </p>
                )}
                <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">
                  {pkg.name}
                </h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  {pkg.durationDays}D / {pkg.durationNights}N
                </p>
                <p className="mt-auto pt-3 text-sm font-bold text-slate-900">
                  {formatCurrency(price, pkg.currency)}
                  <span className="ml-1 text-xs font-normal text-slate-500">per person</span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </SectionShell>
  );
}

export function RelatedDestinations({
  destinations,
  title = "Nearby destinations",
  subtitle,
  moreHref = "/destinations",
}: {
  destinations: RelatedDestination[];
  title?: string;
  subtitle?: string;
  moreHref?: string;
}) {
  if (destinations.length === 0) return null;

  return (
    <SectionShell title={title} subtitle={subtitle} moreHref={moreHref} moreLabel="All destinations">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {destinations.map((destination) => (
          <Link
            key={destination.id}
            href={`/destinations/${destination.slug}`}
            className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-slate-200"
          >
            {destination.coverImage && (
              <Image
                src={destination.coverImage}
                alt={destination.name}
                fill
                loading="lazy"
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="text-xs uppercase tracking-wide text-white/80">{destination.country}</p>
              <p className="font-display text-lg font-bold">{destination.name}</p>
              {destination.packageCount > 0 && (
                <p className="text-xs text-white/80">
                  {destination.packageCount} {destination.packageCount === 1 ? "package" : "packages"}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

export function RelatedBlogs({
  posts,
  title = "Travel guides",
  subtitle,
  moreHref = "/blog",
}: {
  posts: RelatedBlog[];
  title?: string;
  subtitle?: string;
  moreHref?: string;
}) {
  if (posts.length === 0) return null;

  return (
    <SectionShell title={title} subtitle={subtitle} moreHref={moreHref} moreLabel="All guides">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg"
          >
            {post.coverImage && (
              <div className="relative aspect-[16/9] bg-slate-100">
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              {post.categoryName && (
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {post.categoryName}
                </p>
              )}
              <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">
                {post.title}
              </h3>
              {post.excerpt && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p>}
              {post.publishedAt && (
                <p className="mt-auto flex items-center gap-1 pt-3 text-xs text-slate-400">
                  <CalendarDays className="h-3.5 w-3.5" /> {formatDate(post.publishedAt)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

/** Compact text links — for a footer or sidebar, where cards would be too much. */
export function PopularDestinations({
  destinations,
  title = "Popular destinations",
}: {
  destinations: RelatedDestination[];
  title?: string;
}) {
  if (destinations.length === 0) return null;

  return (
    <nav aria-label={title} className="mt-14">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {destinations.map((destination) => (
          <li key={destination.id}>
            <Link
              href={`/destinations/${destination.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            >
              <MapPin className="h-3.5 w-3.5" /> {destination.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Guides as a plain list — used where a card grid would crowd the page. */
export function TravelGuides({
  posts,
  title = "Read before you go",
}: {
  posts: RelatedBlog[];
  title?: string;
}) {
  if (posts.length === 0) return null;

  return (
    <nav aria-label={title} className="mt-14 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 font-display text-xl font-bold text-slate-900">{title}</h2>
      <ul className="divide-y divide-slate-100">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog/${post.slug}`}
              className="group flex items-center justify-between gap-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900 group-hover:text-brand-700">
                  {post.title}
                </span>
                {post.excerpt && (
                  <span className="mt-0.5 block truncate text-sm text-slate-500">{post.excerpt}</span>
                )}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand-600" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
