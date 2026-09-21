import { customClassName, customElementId, isHiddenEverywhere } from "@/lib/builder/styles";
import { str, safeHref } from "@/lib/builder/content";
import {
  loadBlogPosts,
  loadCategories,
  loadDestinations,
  loadPackages,
  loadTestimonials,
} from "@/lib/builder/data";
import type { BuilderNode } from "@/lib/builder/schema";
import { EnquiryButton } from "@/components/enquiry/EnquiryButton";
import { WhatsAppLink } from "@/components/site/WhatsAppLink";
import {
  AccordionBlock,
  FaqBlock,
  LeadFormBlock,
  PackageSearchBlock,
  StatisticsBlock,
  TabsBlock,
} from "@/components/builder/interactive";
import {
  BlogGridView,
  BookingCtaView,
  ButtonView,
  CardsView,
  CategoryStripView,
  ComparisonTableView,
  CtaView,
  DestinationGridView,
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
  PackageGridView,
  PricingTableView,
  RichTextView,
  SpacerView,
  TestimonialsView,
  TextView,
  TimelineView,
  TrustBadgesView,
  VideoView,
} from "@/components/builder/views";

/**
 * Renders one builder node on the server.
 *
 * Layout nodes render their children; data-driven nodes load their records
 * here and hand them to the same presentational view the editor canvas uses.
 * Styling is applied by the stylesheet `RenderDocument` emits, matched on the
 * `data-b` attribute — nothing is styled inline, so the markup stays cacheable.
 */

export type RenderContext = {
  whatsappNumber?: string;
  /** Set on a package or destination page so related elements know the subject. */
  packageId?: string;
  destinationId?: string;
  destinationSlug?: string;
};

type Props = { node: BuilderNode; ctx: RenderContext };

/** Attributes every rendered node carries. */
function nodeAttributes(node: BuilderNode) {
  const className = customClassName(node.settings);
  const id = customElementId(node.settings);
  return {
    "data-b": node.id,
    ...(className ? { className } : {}),
    ...(id ? { id } : {}),
  };
}

export async function RenderNode({ node, ctx }: Props) {
  // An element hidden on every device is not rendered at all, so its content
  // never reaches the page source.
  if (isHiddenEverywhere(node.settings)) return null;

  const attrs = nodeAttributes(node);
  const content = node.content;

  switch (node.type) {
    /* ── layout ── */
    case "section":
      return (
        <section {...attrs} className={`vd-section ${attrs.className ?? ""}`.trim()}>
          <RenderChildren node={node} ctx={ctx} />
        </section>
      );

    case "container":
      return (
        <div {...attrs} className={`vd-container mx-auto ${attrs.className ?? ""}`.trim()}>
          <RenderChildren node={node} ctx={ctx} />
        </div>
      );

    case "columns":
      return (
        <div {...attrs} className={`vd-columns ${attrs.className ?? ""}`.trim()}>
          <RenderChildren node={node} ctx={ctx} />
        </div>
      );

    case "column":
      return (
        <div {...attrs}>
          <RenderChildren node={node} ctx={ctx} />
        </div>
      );

    /* ── basic ── */
    case "heading":
      return (
        <div {...attrs}>
          <HeadingView content={content} />
        </div>
      );
    case "text":
      return (
        <div {...attrs}>
          <TextView content={content} />
        </div>
      );
    case "richText":
      return (
        <div {...attrs}>
          <RichTextView content={content} />
        </div>
      );
    case "html":
      return (
        <div {...attrs}>
          <HtmlView content={content} />
        </div>
      );
    case "image":
      return (
        <div {...attrs}>
          <ImageView content={content} />
        </div>
      );
    case "video":
      return (
        <div {...attrs}>
          <VideoView content={content} />
        </div>
      );
    case "button":
      return (
        <div {...attrs}>
          <ButtonView content={content} />
        </div>
      );
    case "icon":
      return (
        <div {...attrs}>
          <IconView content={content} />
        </div>
      );
    case "divider":
      return (
        <div {...attrs}>
          <DividerView />
        </div>
      );
    case "spacer":
      return (
        <div {...attrs}>
          <SpacerView content={content} />
        </div>
      );

    /* ── content ── */
    case "imageText":
      return (
        <div {...attrs}>
          <ImageTextView content={content} />
        </div>
      );
    case "cards":
      return (
        <div {...attrs}>
          <CardsView content={content} animate />
        </div>
      );
    case "featureList":
      return (
        <div {...attrs}>
          <FeatureListView content={content} animate />
        </div>
      );
    case "gallery":
      return (
        <div {...attrs}>
          <GalleryView content={content} animate />
        </div>
      );
    case "logoGrid":
      return (
        <div {...attrs}>
          <LogoGridView content={content} animate />
        </div>
      );
    case "pricingTable":
      return (
        <div {...attrs}>
          <PricingTableView content={content} animate />
        </div>
      );
    case "comparisonTable":
      return (
        <div {...attrs}>
          <ComparisonTableView content={content} />
        </div>
      );
    case "timeline":
      return (
        <div {...attrs}>
          <TimelineView content={content} />
        </div>
      );
    case "trustBadges":
      return (
        <div {...attrs}>
          <TrustBadgesView content={content} animate />
        </div>
      );

    case "statistics":
      // Counting up needs the client; a static list does not.
      return (
        <div {...attrs}>
          <StatisticsBlock content={content} />
        </div>
      );
    case "accordion":
      return (
        <div {...attrs}>
          <AccordionBlock content={content} />
        </div>
      );
    case "tabs":
      return (
        <div {...attrs}>
          <TabsBlock content={content} />
        </div>
      );
    case "faq":
      return (
        <div {...attrs}>
          <FaqView content={content}>
            <FaqBlock content={content} />
          </FaqView>
        </div>
      );

    case "testimonials": {
      const manual = str(content, "source", "published") === "manual";
      const items = manual
        ? // Manually written testimonials are stored on the element itself.
          (Array.isArray(content?.items) ? content.items : [])
            .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
            .map((item, index) => ({
              id: `manual-${index}`,
              name: typeof item.name === "string" ? item.name : "",
              text: typeof item.text === "string" ? item.text : "",
              rating: Number(item.rating) || 5,
              image: typeof item.image === "string" ? item.image : null,
            }))
        : await loadTestimonials(content?.limit);
      return (
        <div {...attrs}>
          <TestimonialsView content={content} items={items} animate />
        </div>
      );
    }

    /* ── travel ── */
    case "packageGrid": {
      const packages = await loadPackages({
        source: content?.source,
        items: content?.items,
        limit: content?.limit,
        destinationSlug: content?.destinationSlug || ctx.destinationSlug,
      });
      return (
        <div {...attrs}>
          <PackageGridView content={content} packages={packages} animate />
        </div>
      );
    }

    case "relatedPackages": {
      // On a destination page this narrows to that destination; elsewhere it
      // falls back to featured packages rather than showing nothing.
      const packages = await loadPackages({
        source: ctx.destinationSlug ? "latest" : "featured",
        limit: content?.limit ?? 3,
        destinationSlug: ctx.destinationSlug,
      });
      return (
        <div {...attrs}>
          <PackageGridView content={content} packages={packages} animate />
        </div>
      );
    }

    case "destinationGrid": {
      const destinations = await loadDestinations({
        source: content?.source,
        items: content?.items,
        limit: content?.limit,
      });
      return (
        <div {...attrs}>
          <DestinationGridView content={content} destinations={destinations} animate />
        </div>
      );
    }

    case "relatedDestinations": {
      const destinations = await loadDestinations({ source: "popular", limit: content?.limit ?? 4 });
      return (
        <div {...attrs}>
          <DestinationGridView content={content} destinations={destinations} animate />
        </div>
      );
    }

    case "blogGrid": {
      const posts = await loadBlogPosts({
        source: content?.source,
        items: content?.items,
        limit: content?.limit,
      });
      return (
        <div {...attrs}>
          <BlogGridView content={content} posts={posts} animate />
        </div>
      );
    }

    case "categoryStrip": {
      const categories = await loadCategories(content?.limit);
      return (
        <div {...attrs}>
          <CategoryStripView content={content} categories={categories} />
        </div>
      );
    }

    case "packageSearch":
      return (
        <div {...attrs}>
          <PackageSearchBlock content={content} />
        </div>
      );

    case "enquiryForm":
      return (
        <div {...attrs}>
          <LeadFormBlock content={content} variant="full" />
        </div>
      );

    case "leadForm":
      return (
        <div {...attrs}>
          <LeadFormBlock content={content} variant={content?.compact === false ? "full" : "compact"} />
        </div>
      );

    case "newsletter":
      return (
        <div {...attrs}>
          <LeadFormBlock content={content} variant="newsletter" />
        </div>
      );

    case "whatsappCta":
      return (
        <div {...attrs}>
          <WhatsAppLink
            number={ctx.whatsappNumber ?? ""}
            message={str(content, "message", "Hi! I'd like to plan a trip.")}
            label={str(content, "label", "Chat on WhatsApp")}
          />
        </div>
      );

    case "bookingCta":
      return (
        <div {...attrs}>
          <BookingCtaView
            content={content}
            enquirySlot={
              str(content, "enquiryLabel") ? (
                <EnquiryButton
                  label={str(content, "enquiryLabel")}
                  title={str(content, "enquiryLabel")}
                  variant="outline"
                  source="booking-cta"
                />
              ) : null
            }
          />
        </div>
      );

    /* ── marketing ── */
    case "hero":
      return (
        <div {...attrs}>
          <HeroView
            content={content}
            secondarySlot={
              str(content, "secondaryLabel") ? (
                str(content, "secondaryAction", "enquiry") === "enquiry" ? (
                  <EnquiryButton
                    label={str(content, "secondaryLabel")}
                    title={str(content, "secondaryLabel")}
                    size="lg"
                    variant="outline"
                    className="bg-white/10 text-white hover:bg-white/20"
                    source="hero"
                  />
                ) : (
                  <a
                    href={safeHref(content?.secondaryHref)}
                    className="inline-flex h-12 items-center rounded-lg border border-white/40 bg-white/10 px-7 text-base font-semibold text-white hover:bg-white/20"
                  >
                    {str(content, "secondaryLabel")}
                  </a>
                )
              ) : null
            }
          />
        </div>
      );

    case "cta":
      return (
        <div {...attrs}>
          <CtaView content={content} />
        </div>
      );

    default:
      // An element type this build does not know about — a document saved by a
      // newer version, say. Rendering nothing beats crashing the page.
      return null;
  }
}

async function RenderChildren({ node, ctx }: Props) {
  const children = node.children ?? [];
  if (children.length === 0) return null;
  return (
    <>
      {children.map((child) => (
        <RenderNode key={child.id} node={child} ctx={ctx} />
      ))}
    </>
  );
}
