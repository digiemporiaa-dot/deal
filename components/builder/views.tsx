/* eslint-disable @next/next/no-img-element --
 *
 * Builder images are URLs an admin types or picks from the media library, and
 * can point at any host. `next/image` throws at request time for a host that
 * is not in `next.config.mjs` remotePatterns, which would turn a pasted URL
 * into a 500 on a public page. Plain <img> with explicit lazy loading and an
 * aspect-ratio box gives the same CLS and loading behaviour without that
 * failure mode. Images inside the fixed catalogue components (package and
 * destination cards) still go through next/image elsewhere in the app.
 */
import * as React from "react";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getIcon } from "@/components/builder/icons";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  bool,
  embedUrl,
  headingTag,
  itemStr,
  lines,
  linkAttributes,
  list,
  num,
  safeHref,
  safeImageSrc,
  str,
} from "@/lib/builder/content";
import type { NodeContent } from "@/lib/builder/schema";
import type {
  BlogCardData,
  DestinationCardData,
  PackageCardData,
  TestimonialData,
} from "@/lib/builder/data";

/**
 * Presentational views for every builder element.
 *
 * Deliberately free of `"use client"`, hooks, `async` and data access: the
 * server renderer and the editor canvas both import these, so the same markup
 * describes the published page and the preview. Data-driven elements receive
 * already-loaded records as props — fetching happens in the server renderer,
 * or is faked by the canvas.
 */

type ViewProps = { content?: NodeContent };

/* ─────────────────────────── basic ─────────────────────────── */

export function HeadingView({ content }: ViewProps) {
  const Tag = headingTag(content?.tag);
  const text = str(content, "text");
  if (!text) return null;
  return <Tag className="vd-heading">{text}</Tag>;
}

export function TextView({ content }: ViewProps) {
  const text = str(content, "text");
  if (!text) return null;
  // Newlines an admin typed are meaningful; `white-space: pre-line` keeps them
  // without letting any markup through.
  return <p style={{ whiteSpace: "pre-line" }}>{text}</p>;
}

export function RichTextView({ content }: ViewProps) {
  const html = sanitizeHtml(str(content, "html"));
  if (!html) return null;
  return <div className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Custom HTML. Sanitised on save and again here, in case the rules tightened. */
export function HtmlView({ content }: ViewProps) {
  const html = sanitizeHtml(str(content, "html"));
  if (!html) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ImageView({ content }: ViewProps) {
  const src = safeImageSrc(content?.src);
  const alt = str(content, "alt");
  const caption = str(content, "caption");
  const href = str(content, "href");
  const ratio = str(content, "ratio", "auto");
  const objectFit = str(content, "objectFit", "cover") === "contain" ? "contain" : "cover";

  if (!src) {
    return (
      <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
        No image selected
      </div>
    );
  }

  const image = (
    <img
      src={src}
      alt={alt}
      title={str(content, "title") || undefined}
      loading="lazy"
      decoding="async"
      className="h-full w-full"
      style={{
        objectFit,
        // An explicit ratio reserves the space before the image loads, which
        // is what stops the page jumping.
        ...(ratio !== "auto" ? { aspectRatio: ratio } : {}),
      }}
    />
  );

  const figure = (
    <figure className="m-0">
      <div className="overflow-hidden rounded-[inherit]" style={ratio !== "auto" ? { aspectRatio: ratio } : undefined}>
        {href ? (
          <Link href={safeHref(href)} {...linkAttributes(content)}>
            {image}
          </Link>
        ) : (
          image
        )}
      </div>
      {caption && <figcaption className="mt-2 text-sm text-slate-500">{caption}</figcaption>}
    </figure>
  );

  return figure;
}

export function VideoView({ content }: ViewProps) {
  const url = embedUrl(content?.url);
  if (!url) {
    return (
      <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
        Add a YouTube or Vimeo link
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[inherit]" style={{ aspectRatio: "16/9" }}>
      <iframe
        src={url}
        title={str(content, "title", "Video")}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}

/**
 * Button styles for the builder's Button element.
 *
 * These read the same theme variables the site-wide Button component does, so
 * a button dropped onto a built page follows Admin → Appearance like every
 * other button. Before this they were a private copy of the palette, which
 * meant changing the brand or secondary colour left built pages behind.
 */
const BUTTON_VARIANTS: Record<string, string> = {
  primary: "bg-brand-600 text-site-button-text hover:bg-brand-700",
  secondary: "bg-site-button2-bg text-site-button2-text hover:bg-site-button2-hover",
  outline: "border border-current bg-transparent hover:bg-black/5",
  ghost: "bg-transparent underline-offset-4 hover:underline",
};

const BUTTON_SIZES: Record<string, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export function ButtonView({ content }: ViewProps) {
  const label = str(content, "label", "Button");
  const variant = BUTTON_VARIANTS[str(content, "variant", "primary")] ?? BUTTON_VARIANTS.primary;
  const size = BUTTON_SIZES[str(content, "size", "md")] ?? BUTTON_SIZES.md;
  const iconName = str(content, "icon");
  const iconRight = str(content, "iconPosition") === "right";
  const Icon = iconName ? getIcon(iconName) : null;

  return (
    <Link
      href={safeHref(content?.href)}
      {...linkAttributes(content)}
      className={`inline-flex w-fit items-center justify-center gap-2 rounded-[var(--site-button-radius)] font-semibold transition-colors ${variant} ${size}`}
    >
      {Icon && !iconRight && <Icon className="h-4 w-4" aria-hidden />}
      {label}
      {Icon && iconRight && <Icon className="h-4 w-4" aria-hidden />}
    </Link>
  );
}

export function IconView({ content }: ViewProps) {
  const Icon = getIcon(content?.name);
  const size = Math.max(12, Math.min(160, num(content, "size", 32)));
  return <Icon style={{ width: size, height: size }} aria-hidden />;
}

export function DividerView() {
  return <hr className="border-0 border-t border-current opacity-20" />;
}

export function SpacerView({ content }: ViewProps) {
  return <div style={{ height: Math.max(4, Math.min(400, num(content, "height", 48))) }} aria-hidden />;
}

/* ────────────────────────── content ────────────────────────── */

export function ImageTextView({ content }: ViewProps) {
  const src = safeImageSrc(content?.image);
  const reverse = str(content, "imagePosition", "left") === "right";
  const buttonLabel = str(content, "buttonLabel");

  return (
    <div className={`grid items-center gap-8 md:grid-cols-2 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
      <div>
        {src ? (
          <img
            src={src}
            alt={str(content, "alt")}
            loading="lazy"
            decoding="async"
            className="w-full rounded-2xl object-cover"
            style={{ aspectRatio: "4/3" }}
          />
        ) : (
          <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-400">
            No image
          </div>
        )}
      </div>
      <div>
        {str(content, "eyebrow") && (
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            {str(content, "eyebrow")}
          </p>
        )}
        {str(content, "title") && (
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">{str(content, "title")}</h2>
        )}
        {str(content, "text") && (
          <p className="mt-3 text-slate-600" style={{ whiteSpace: "pre-line" }}>
            {str(content, "text")}
          </p>
        )}
        {buttonLabel && (
          <Link
            href={safeHref(content?.buttonHref)}
            className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {buttonLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

/** Wraps a grid whose column count comes from the node's own settings. */
/**
 * A grid of cards.
 *
 * `animate` staggers the cards in as the grid reaches the viewport, and is
 * off unless the published renderer asks for it. That default is the whole
 * point: the editor canvas imports these same views, and an admin arranging
 * cards must never find them starting invisible or sliding about under the
 * cursor. Only `RenderNode`, rendering a live page, turns it on.
 */
function Grid({ children, animate }: { children: React.ReactNode; animate?: boolean }) {
  if (!animate) return <div className="vd-grid grid gap-6">{children}</div>;

  return (
    <Stagger className="vd-grid grid gap-6">
      {React.Children.map(children, (child) => (
        <StaggerItem className="h-full">{child}</StaggerItem>
      ))}
    </Stagger>
  );
}

export function SectionHeadingView({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}) {
  if (!eyebrow && !title && !subtitle) return null;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
        )}
        {title && <h2 className="mt-1 font-display text-3xl font-bold text-slate-900">{title}</h2>}
        {subtitle && <p className="mt-2 max-w-2xl text-slate-600">{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link href={safeHref(href)} className="text-sm font-semibold text-brand-600 hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

export function CardsView({ content, animate }: ViewProps & { animate?: boolean }) {
  const items = list(content, "items");
  const style = str(content, "style", "icon");
  if (items.length === 0) return <EmptyHint label="Add some cards" />;

  return (
    <div>
      <SectionHeadingView title={str(content, "title")} subtitle={str(content, "subtitle")} />
      <Grid animate={animate}>
        {items.map((item, index) => {
          const Icon = getIcon(item.icon);
          const image = safeImageSrc(item.image);
          const href = itemStr(item, "href");
          const inner = (
            <>
              {style === "image" && image && (
                <img
                  src={image}
                  alt={itemStr(item, "title")}
                  loading="lazy"
                  decoding="async"
                  className="mb-4 w-full rounded-xl object-cover"
                  style={{ aspectRatio: "16/9" }}
                />
              )}
              {style === "icon" && (
                <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
              )}
              {itemStr(item, "title") && (
                <h3 className="text-lg font-semibold text-slate-900">{itemStr(item, "title")}</h3>
              )}
              {itemStr(item, "text") && (
                <p className="mt-2 text-sm text-slate-600">{itemStr(item, "text")}</p>
              )}
            </>
          );

          const className = "rounded-2xl border border-slate-200 bg-white p-6";
          return href ? (
            <Link key={index} href={safeHref(href)} className={`${className} transition-shadow hover:shadow-md`}>
              {inner}
            </Link>
          ) : (
            <div key={index} className={className}>
              {inner}
            </div>
          );
        })}
      </Grid>
    </div>
  );
}

export function FeatureListView({ content, animate }: ViewProps & { animate?: boolean }) {
  const items = list(content, "items");
  if (items.length === 0) return <EmptyHint label="Add some list items" />;
  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const Icon = getIcon(item.icon ?? "Check");
        return (
          <li key={index} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
            <span>{itemStr(item, "text")}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function StatisticsView({ content, animate }: ViewProps & { animate?: boolean }) {
  const items = list(content, "items");
  if (items.length === 0) return <EmptyHint label="Add some statistics" />;
  return (
    <Grid animate={animate}>
      {items.map((item, index) => (
        <div key={index} className="text-center">
          <p className="font-display text-4xl font-bold text-slate-900">{itemStr(item, "value")}</p>
          <p className="mt-1 text-sm text-slate-500">{itemStr(item, "label")}</p>
        </div>
      ))}
    </Grid>
  );
}

export function GalleryView({ content, animate }: ViewProps & { animate?: boolean }) {
  const items = list(content, "items");
  if (items.length === 0) return <EmptyHint label="Add some images" />;
  return (
    <Grid animate={animate}>
      {items.map((item, index) => {
        const src = safeImageSrc(item.src);
        if (!src) return null;
        return (
          <img
            key={index}
            src={src}
            alt={itemStr(item, "alt")}
            title={itemStr(item, "title") || undefined}
            loading="lazy"
            decoding="async"
            className="w-full rounded-xl object-cover"
            style={{ aspectRatio: "1/1" }}
          />
        );
      })}
    </Grid>
  );
}

export function LogoGridView({ content, animate }: ViewProps & { animate?: boolean }) {
  const items = list(content, "items");
  if (items.length === 0) return <EmptyHint label="Add some logos" />;
  return (
    <Grid animate={animate}>
      {items.map((item, index) => {
        const src = safeImageSrc(item.image);
        if (!src) return null;
        const logo = (
          <img
            src={src}
            alt={itemStr(item, "alt")}
            loading="lazy"
            decoding="async"
            className="h-12 w-full object-contain opacity-70 transition-opacity hover:opacity-100"
          />
        );
        const href = itemStr(item, "href");
        return href ? (
          <Link key={index} href={safeHref(href)}>
            {logo}
          </Link>
        ) : (
          <div key={index}>{logo}</div>
        );
      })}
    </Grid>
  );
}

export function PricingTableView({ content, animate }: ViewProps & { animate?: boolean }) {
  const plans = list(content, "plans");
  if (plans.length === 0) return <EmptyHint label="Add a pricing plan" />;
  return (
    <Grid animate={animate}>
      {plans.map((plan, index) => {
        const featured = plan.featured === true;
        const features = itemStr(plan, "features")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        return (
          <div
            key={index}
            className={`rounded-2xl border p-6 ${featured ? "border-brand-500 shadow-lg" : "border-slate-200"}`}
          >
            <h3 className="font-semibold text-slate-900">{itemStr(plan, "name")}</h3>
            <p className="mt-3">
              <span className="font-display text-3xl font-bold text-slate-900">{itemStr(plan, "price")}</span>
              {itemStr(plan, "period") && (
                <span className="ml-1 text-sm text-slate-500">{itemStr(plan, "period")}</span>
              )}
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              {features.map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 text-emerald-500">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            {itemStr(plan, "buttonLabel") && (
              <Link
                href={safeHref(plan.buttonHref)}
                className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold ${
                  featured ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 hover:bg-slate-50"
                }`}
              >
                {itemStr(plan, "buttonLabel")}
              </Link>
            )}
          </div>
        );
      })}
    </Grid>
  );
}

export function ComparisonTableView({ content }: ViewProps) {
  const headers = lines(content, "headers");
  const rows = list(content, "rows");
  if (headers.length === 0) return <EmptyHint label="Add column headings" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {headers.map((header, index) => (
              <th key={index} scope="col" className="px-4 py-3 font-semibold text-slate-900">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const cells = itemStr(row, "cells")
              .split("\n")
              .map((cell) => cell.trim());
            return (
              <tr key={rowIndex} className="border-b border-slate-100">
                {headers.map((_, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 text-slate-600">
                    {cells[cellIndex] ?? ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TimelineView({ content }: ViewProps) {
  const items = list(content, "items");
  if (items.length === 0) return <EmptyHint label="Add a step" />;
  return (
    <ol className="relative space-y-6 border-l border-slate-200 pl-6">
      {items.map((item, index) => (
        <li key={index}>
          <span className="absolute -left-[7px] mt-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-brand-600" aria-hidden />
          {itemStr(item, "label") && (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              {itemStr(item, "label")}
            </p>
          )}
          <h3 className="mt-0.5 font-semibold text-slate-900">{itemStr(item, "title")}</h3>
          {itemStr(item, "text") && <p className="mt-1 text-sm text-slate-600">{itemStr(item, "text")}</p>}
        </li>
      ))}
    </ol>
  );
}

export function TestimonialsView({
  content,
  items, animate }: ViewProps & { items: TestimonialData[]; animate?: boolean }) {
  if (items.length === 0) return <EmptyHint label="No testimonials to show yet" />;
  return (
    <div>
      <SectionHeadingView title={str(content, "title")} />
      <Grid animate={animate}>
        {items.map((item) => (
          <figure key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex gap-0.5 text-amber-400" aria-label={`${item.rating} out of 5`}>
              {Array.from({ length: 5 }).map((_, index) => (
                <span key={index} aria-hidden>
                  {index < item.rating ? "★" : "☆"}
                </span>
              ))}
            </div>
            <blockquote className="mt-3 text-sm text-slate-600">{item.text}</blockquote>
            <figcaption className="mt-4 text-sm font-semibold text-slate-900">{item.name}</figcaption>
          </figure>
        ))}
      </Grid>
    </div>
  );
}

export function TrustBadgesView({ content, animate }: ViewProps & { animate?: boolean }) {
  const items = list(content, "items");
  if (items.length === 0) return <EmptyHint label="Add a trust badge" />;
  return (
    <Grid animate={animate}>
      {items.map((item, index) => {
        const Icon = getIcon(item.icon);
        return (
          <div key={index} className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-slate-900">{itemStr(item, "title")}</p>
              <p className="text-sm text-slate-600">{itemStr(item, "text")}</p>
            </div>
          </div>
        );
      })}
    </Grid>
  );
}

/* ────────────────────────── marketing ───────────────────────── */

export function HeroView({
  content,
  secondarySlot,
}: ViewProps & { secondarySlot?: React.ReactNode }) {
  const src = safeImageSrc(content?.image);
  const BadgeIcon = str(content, "badgeIcon") ? getIcon(content?.badgeIcon) : null;
  const height = str(content, "height", "85vh");

  return (
    <div className="relative isolate overflow-hidden rounded-[inherit]">
      {src && (
        <img
          src={src}
          alt={str(content, "imageAlt")}
          // The hero is the largest contentful paint on most pages, so it is
          // the one image that must not be lazy.
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 -z-10 vd-hero-overlay" aria-hidden />
      <div
        className="mx-auto flex w-full max-w-[1200px] flex-col justify-center px-4 py-24"
        style={{ minHeight: height }}
      >
        {str(content, "badge") && (
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm backdrop-blur">
            {BadgeIcon && <BadgeIcon className="h-4 w-4" aria-hidden />}
            {str(content, "badge")}
          </p>
        )}
        {str(content, "title") && (
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            {str(content, "title")}
          </h1>
        )}
        {str(content, "subtitle") && (
          <p className="mt-5 max-w-xl text-lg" style={{ whiteSpace: "pre-line" }}>
            {str(content, "subtitle")}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          {str(content, "primaryLabel") && (
            <Link
              href={safeHref(content?.primaryHref)}
              className="inline-flex h-12 items-center rounded-lg bg-brand-600 px-7 text-base font-semibold text-white hover:bg-brand-700"
            >
              {str(content, "primaryLabel")}
            </Link>
          )}
          {secondarySlot}
        </div>
      </div>
    </div>
  );
}

export function CtaView({ content, enquirySlot }: ViewProps & { enquirySlot?: React.ReactNode }) {
  const src = safeImageSrc(content?.image);
  return (
    <div className="relative isolate overflow-hidden rounded-[inherit] text-center">
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
        />
      )}
      {str(content, "title") && (
        <h2 className="font-display text-3xl font-bold">{str(content, "title")}</h2>
      )}
      {str(content, "text") && <p className="mx-auto mt-3 max-w-xl opacity-90">{str(content, "text")}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {str(content, "buttonLabel") && (
          <Link
            href={safeHref(content?.buttonHref)}
            className="inline-flex h-12 items-center rounded-lg bg-white px-7 text-base font-semibold text-slate-900 hover:bg-slate-100"
          >
            {str(content, "buttonLabel")}
          </Link>
        )}
        {enquirySlot}
      </div>
    </div>
  );
}

export function BookingCtaView({ content, enquirySlot }: ViewProps & { enquirySlot?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-8">
      <div>
        {str(content, "title") && (
          <h2 className="font-display text-2xl font-bold text-slate-900">{str(content, "title")}</h2>
        )}
        {str(content, "text") && <p className="mt-2 text-slate-600">{str(content, "text")}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        {str(content, "buttonLabel") && (
          <Link
            href={safeHref(content?.buttonHref)}
            className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {str(content, "buttonLabel")}
          </Link>
        )}
        {enquirySlot}
      </div>
    </div>
  );
}

/* ─────────────────────────── travel ─────────────────────────── */

export function PackageGridView({
  content,
  packages, animate }: ViewProps & { packages: PackageCardData[]; animate?: boolean }) {
  return (
    <div>
      <SectionHeadingView
        eyebrow={str(content, "eyebrow")}
        title={str(content, "title")}
        subtitle={str(content, "subtitle")}
        href={str(content, "linkHref")}
        linkLabel={str(content, "linkLabel")}
      />
      {packages.length === 0 ? (
        <EmptyHint label="No packages match this selection yet" />
      ) : (
        <Grid animate={animate}>
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/packages/${pkg.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg"
            >
              <div className="relative bg-slate-100" style={{ aspectRatio: "4/3" }}>
                {pkg.image && (
                  <img
                    src={pkg.image}
                    alt={pkg.imageAlt || pkg.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {pkg.destination && <p className="text-xs text-slate-500">{pkg.destination}</p>}
                <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">
                  {pkg.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {pkg.durationDays}D / {pkg.durationNights}N
                </p>
                <p className="mt-auto pt-3 text-sm font-bold text-slate-900">
                  {formatCurrency(pkg.price, pkg.currency)}
                  {pkg.hasDiscount && (
                    <span className="ml-2 text-xs font-normal text-slate-400 line-through">
                      {formatCurrency(pkg.listPrice, pkg.currency)}
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </Grid>
      )}
    </div>
  );
}

export function DestinationGridView({
  content,
  destinations, animate }: ViewProps & { destinations: DestinationCardData[]; animate?: boolean }) {
  return (
    <div>
      <SectionHeadingView
        eyebrow={str(content, "eyebrow")}
        title={str(content, "title")}
        subtitle={str(content, "subtitle")}
        href={str(content, "linkHref")}
        linkLabel={str(content, "linkLabel")}
      />
      {destinations.length === 0 ? (
        <EmptyHint label="No destinations match this selection yet" />
      ) : (
        <Grid animate={animate}>
          {destinations.map((destination) => (
            <Link
              key={destination.id}
              href={`/destinations/${destination.slug}`}
              className="group relative block overflow-hidden rounded-2xl bg-slate-200"
              style={{ aspectRatio: "3/4" }}
            >
              {destination.image && (
                <img
                  src={destination.image}
                  alt={destination.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
              <span className="absolute inset-x-0 bottom-0 block p-4 text-white">
                <span className="block text-xs uppercase tracking-wide text-white/80">
                  {destination.country}
                </span>
                <span className="block font-display text-lg font-bold">{destination.name}</span>
                {destination.packageCount > 0 && (
                  <span className="block text-xs text-white/80">
                    {destination.packageCount} {destination.packageCount === 1 ? "package" : "packages"}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </Grid>
      )}
    </div>
  );
}

export function BlogGridView({ content, posts, animate }: ViewProps & { posts: BlogCardData[]; animate?: boolean }) {
  return (
    <div>
      <SectionHeadingView
        eyebrow={str(content, "eyebrow")}
        title={str(content, "title")}
        subtitle={str(content, "subtitle")}
        href={str(content, "linkHref")}
        linkLabel={str(content, "linkLabel")}
      />
      {posts.length === 0 ? (
        <EmptyHint label="No posts to show yet" />
      ) : (
        <Grid animate={animate}>
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="bg-slate-100" style={{ aspectRatio: "16/9" }}>
                {post.image && (
                  <img
                    src={post.image}
                    alt={post.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                )}
              </div>
              <div className="p-5">
                {post.category && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {post.category}
                  </p>
                )}
                <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold text-slate-900 group-hover:text-brand-700">
                  {post.title}
                </h3>
                {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p>}
                {post.publishedAt && (
                  <p className="mt-3 text-xs text-slate-500">{formatDate(post.publishedAt)}</p>
                )}
              </div>
            </Link>
          ))}
        </Grid>
      )}
    </div>
  );
}

export function CategoryStripView({
  categories,
}: ViewProps & { categories: { id: string; name: string; slug: string }[] }) {
  if (categories.length === 0) return <EmptyHint label="No package categories yet" />;
  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/packages?category=${category.slug}`}
          className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-colors hover:bg-brand-50"
        >
          <span className="text-sm font-medium text-slate-700">{category.name}</span>
        </Link>
      ))}
    </div>
  );
}

export function FaqView({ content, children }: ViewProps & { children?: React.ReactNode }) {
  const title = str(content, "title");
  return (
    <div>
      {title && <h2 className="mb-6 font-display text-3xl font-bold text-slate-900">{title}</h2>}
      {children}
    </div>
  );
}

/* ─────────────────────────── helpers ────────────────────────── */

/**
 * Shown where an element has nothing to display. Visible in the editor so the
 * gap is explained; on a published page it is a quiet placeholder rather than
 * a blank hole that looks like a bug.
 */
export function EmptyHint({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
      {label}
    </p>
  );
}

export { bool, num, str };
