"use client";

import { Database } from "lucide-react";
import { getElementDef, DYNAMIC_TYPES } from "@/lib/builder/registry";
import { str, num, list } from "@/lib/builder/content";
import type { BuilderNode, Breakpoint } from "@/lib/builder/schema";
import {
  AccordionBlock,
  FaqBlock,
  LeadFormBlock,
  PackageSearchBlock,
  StatisticsBlock,
  TabsBlock,
} from "@/components/builder/interactive";
import {
  BookingCtaView,
  ButtonView,
  CardsView,
  ComparisonTableView,
  CtaView,
  DividerView,
  FaqView,
  FeatureListView,
  GalleryView,
  HeadingView,
  HeroView,
  HtmlView,
  IconView,
  ImageTextView,
  ImageView,
  LogoGridView,
  PricingTableView,
  RichTextView,
  SpacerView,
  TextView,
  TimelineView,
  TrustBadgesView,
  VideoView,
} from "@/components/builder/views";

/**
 * How an element looks on the canvas.
 *
 * Static elements render through exactly the same view components as the
 * published page, so the preview is not an approximation of the result — it is
 * the result, minus the data.
 *
 * Data-driven elements cannot query the database from the browser, so they
 * render a labelled placeholder describing the rule they will follow. That is
 * honest about what will appear rather than inventing fake cards that look
 * like real content.
 */

function DynamicPlaceholder({ node }: { node: BuilderNode }) {
  const def = getElementDef(node.type);
  const source = str(node.content, "source", "featured");
  const limit = num(node.content, "limit", 6);
  const manual = source === "manual";
  const chosen = Array.isArray(node.content?.items) ? node.content.items.length : 0;

  const title = str(node.content, "title");
  const subtitle = str(node.content, "subtitle");

  return (
    <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-5">
      {(title || subtitle) && (
        <div className="mb-4 text-center">
          {title && <p className="font-display text-xl font-bold text-slate-900">{title}</p>}
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
      )}

      <p className="flex items-center justify-center gap-2 text-sm font-medium text-brand-700">
        <Database className="h-4 w-4" />
        {def?.label ?? node.type}
      </p>
      <p className="mt-1 text-center text-xs text-slate-500">
        {manual
          ? `${chosen} item${chosen === 1 ? "" : "s"} chosen by hand`
          : `${limit} ${source} item${limit === 1 ? "" : "s"}, loaded live`}
      </p>

      {/* Skeleton cards, so the space the element will occupy is visible. */}
      <div
        className="mt-4 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(manual ? Math.max(chosen, 1) : limit, 4)}, minmax(0,1fr))`,
        }}
      >
        {Array.from({ length: Math.min(manual ? Math.max(chosen, 1) : limit, 4) }).map((_, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-2 rounded bg-slate-100" style={{ aspectRatio: "4/3" }} />
            <div className="h-2 w-3/4 rounded bg-slate-100" />
            <div className="mt-1 h-2 w-1/2 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ElementPreview({ node }: { node: BuilderNode; breakpoint: Breakpoint }) {
  const content = node.content;

  if (DYNAMIC_TYPES.includes(node.type)) {
    // Testimonials written by hand are real content, so they preview properly.
    if (node.type === "testimonials" && str(content, "source", "published") === "manual") {
      const items = list(content, "items");
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">Add a testimonial</p>
          ) : (
            items.map((item, index) => (
              <figure key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
                <blockquote className="text-sm text-slate-600">
                  {typeof item.text === "string" ? item.text : ""}
                </blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-slate-900">
                  {typeof item.name === "string" ? item.name : ""}
                </figcaption>
              </figure>
            ))
          )}
        </div>
      );
    }
    return <DynamicPlaceholder node={node} />;
  }

  switch (node.type) {
    case "heading":
      return <HeadingView content={content} />;
    case "text":
      return <TextView content={content} />;
    case "richText":
      return <RichTextView content={content} />;
    case "html":
      return <HtmlView content={content} />;
    case "image":
      return <ImageView content={content} />;
    case "video":
      return <VideoView content={content} />;
    case "button":
      return <ButtonView content={content} />;
    case "icon":
      return <IconView content={content} />;
    case "divider":
      return <DividerView />;
    case "spacer":
      return <SpacerView content={content} />;
    case "imageText":
      return <ImageTextView content={content} />;
    case "cards":
      return <CardsView content={content} />;
    case "featureList":
      return <FeatureListView content={content} />;
    case "gallery":
      return <GalleryView content={content} />;
    case "logoGrid":
      return <LogoGridView content={content} />;
    case "pricingTable":
      return <PricingTableView content={content} />;
    case "comparisonTable":
      return <ComparisonTableView content={content} />;
    case "timeline":
      return <TimelineView content={content} />;
    case "trustBadges":
      return <TrustBadgesView content={content} />;
    case "statistics":
      return <StatisticsBlock content={content} />;
    case "accordion":
      return <AccordionBlock content={content} />;
    case "tabs":
      return <TabsBlock content={content} />;
    case "faq":
      return (
        <FaqView content={content}>
          <FaqBlock content={content} />
        </FaqView>
      );
    case "hero":
      return (
        <HeroView
          content={content}
          secondarySlot={
            str(content, "secondaryLabel") ? (
              <span className="inline-flex h-12 items-center rounded-lg border border-white/40 bg-white/10 px-7 text-base font-semibold text-white">
                {str(content, "secondaryLabel")}
              </span>
            ) : null
          }
        />
      );
    case "cta":
      return <CtaView content={content} />;
    case "bookingCta":
      return (
        <BookingCtaView
          content={content}
          enquirySlot={
            str(content, "enquiryLabel") ? (
              <span className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700">
                {str(content, "enquiryLabel")}
              </span>
            ) : null
          }
        />
      );
    case "whatsappCta":
      return (
        <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#25D366] px-5 text-sm font-semibold text-white">
          {str(content, "label", "Chat on WhatsApp")}
        </span>
      );
    case "packageSearch":
      return <PackageSearchBlock content={content} />;
    case "enquiryForm":
      return <LeadFormBlock content={content} variant="full" />;
    case "leadForm":
      return <LeadFormBlock content={content} variant={content?.compact === false ? "full" : "compact"} />;
    case "newsletter":
      return <LeadFormBlock content={content} variant="newsletter" />;
    default:
      return (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
          {getElementDef(node.type)?.label ?? node.type}
        </p>
      );
  }
}
