import type { BuilderNode, PageDocument } from "@/lib/builder/schema";

/**
 * Templates shipped with the product.
 *
 * The homepage template is a faithful rebuild of the layout the site shipped
 * with, so an admin's first encounter with the builder is editing something
 * they recognise rather than facing a blank page. Ids here are placeholders —
 * they are regenerated whenever a template is used, so two pages built from
 * one template never share node ids.
 *
 * Seeded by `prisma/seed-templates.ts`, which is idempotent.
 */

let counter = 0;
const id = (prefix: string) => `${prefix}-tpl${(counter += 1).toString(36)}`;

function section(children: BuilderNode[], settings: BuilderNode["settings"] = {}): BuilderNode {
  return {
    id: id("sec"),
    type: "section",
    settings: {
      desktop: { padding: { top: "64px", bottom: "64px", left: "16px", right: "16px" } },
      mobile: { padding: { top: "40px", bottom: "40px", left: "16px", right: "16px" } },
      ...settings,
    },
    children: [
      {
        id: id("con"),
        type: "container",
        settings: {
          desktop: {
            maxWidth: "1200px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          },
        },
        children,
      },
    ],
  };
}

function element(
  type: string,
  content: Record<string, unknown> = {},
  settings: BuilderNode["settings"] = {},
): BuilderNode {
  return { id: id(type.slice(0, 4)), type, content, settings };
}

/* ───────────────────────── section templates ───────────────────────── */

export const heroSection = (): BuilderNode =>
  section(
    [
      element(
        "hero",
        {
          badge: "Trusted by 10,000+ happy travellers",
          badgeIcon: "BadgeCheck",
          title: "Your next journey starts here",
          subtitle:
            "Handcrafted holiday packages, premium stays and effortless planning — all backed by round-the-clock expert support.",
          image:
            "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1920&q=80",
          imageAlt: "Scenic travel destination",
          primaryLabel: "Explore packages",
          primaryHref: "/packages",
          secondaryLabel: "Plan my trip",
          secondaryAction: "enquiry",
          height: "85vh",
        },
        { desktop: { overlay: "rgba(15,23,42,0.6)", color: "#ffffff" } },
      ),
    ],
    // The hero supplies its own spacing, so the section adds none.
    { desktop: { padding: { top: "0", bottom: "0", left: "0", right: "0" } }, mobile: {} },
  );

export const destinationsSection = (): BuilderNode =>
  section([
    element(
      "destinationGrid",
      {
        eyebrow: "Where to next",
        title: "Popular destinations",
        subtitle: "Explore our most-loved destinations, curated by travel experts.",
        source: "featured",
        limit: 6,
        linkHref: "/destinations",
        linkLabel: "View all destinations",
      },
      { desktop: { columns: 6 }, tablet: { columns: 3 }, mobile: { columns: 2 } },
    ),
  ]);

export const packagesSection = (): BuilderNode =>
  section(
    [
      element(
        "packageGrid",
        {
          eyebrow: "Handpicked",
          title: "Featured holiday packages",
          subtitle: "Best-selling itineraries with unbeatable value.",
          source: "featured",
          limit: 6,
          linkHref: "/packages",
          linkLabel: "Browse all packages",
        },
        { desktop: { columns: 3 }, tablet: { columns: 2 }, mobile: { columns: 1 } },
      ),
    ],
    { desktop: { background: "#f8fafc", padding: { top: "64px", bottom: "64px", left: "16px", right: "16px" } } },
  );

export const whyUsSection = (): BuilderNode =>
  section([
    element("heading", { text: "Travel with total confidence", tag: "h2" }, {
      desktop: { fontSize: "32px", fontWeight: "700", textAlign: "center", color: "#0f172a" },
    }),
    element(
      "cards",
      {
        style: "icon",
        items: [
          { icon: "ShieldCheck", title: "Secure booking", text: "Encrypted payments and verified partners on every trip." },
          { icon: "HeartHandshake", title: "Tailor-made trips", text: "Every itinerary is customised to your style and budget." },
          { icon: "Headphones", title: "24×7 support", text: "Real humans, ready to help before, during and after travel." },
          { icon: "BadgeCheck", title: "Best price promise", text: "Premium experiences at genuinely competitive prices." },
        ],
      },
      { desktop: { columns: 4 }, tablet: { columns: 2 }, mobile: { columns: 1 } },
    ),
  ]);

export const testimonialsSection = (): BuilderNode =>
  section(
    [
      element("heading", { text: "What our guests say", tag: "h2" }, {
        desktop: { fontSize: "32px", fontWeight: "700", textAlign: "center", color: "#0f172a" },
      }),
      element("testimonials", { source: "published", limit: 6 }, {
        desktop: { columns: 3 },
        tablet: { columns: 2 },
        mobile: { columns: 1 },
      }),
    ],
    { desktop: { background: "#f8fafc", padding: { top: "64px", bottom: "64px", left: "16px", right: "16px" } } },
  );

export const blogSection = (): BuilderNode =>
  section([
    element(
      "blogGrid",
      {
        eyebrow: "Travel inspiration",
        title: "From our blog",
        source: "latest",
        limit: 3,
        linkHref: "/blog",
        linkLabel: "Read the blog",
      },
      { desktop: { columns: 3 }, mobile: { columns: 1 } },
    ),
  ]);

export const ctaSection = (): BuilderNode =>
  section([
    element(
      "cta",
      {
        title: "Ready for your next holiday?",
        text: "Tell us where you want to go and our travel experts will build the trip around you.",
        buttonLabel: "Get a free quote",
        buttonHref: "/contact",
      },
      {
        desktop: {
          background: "#0d9488",
          color: "#ffffff",
          borderRadius: "24px",
          padding: { top: "56px", bottom: "56px", left: "32px", right: "32px" },
        },
      },
    ),
  ]);

export const faqSection = (): BuilderNode =>
  section([
    element("faq", {
      title: "Frequently asked questions",
      schema: true,
      items: [
        {
          question: "How do I book a package?",
          answer: "Choose a package, pick your travel date and pay the advance online. Our team confirms the rest within a few hours.",
        },
        {
          question: "Can a package be customised?",
          answer: "Yes. Every itinerary can be adjusted for dates, hotels, activities and budget — send us an enquiry and we will rework it.",
        },
      ],
    }),
  ]);

function column(children: BuilderNode[]): BuilderNode {
  return {
    id: id("col"),
    type: "column",
    settings: { desktop: { display: "flex", flexDirection: "column", gap: "16px" } },
    children,
  };
}

export const enquirySection = (): BuilderNode =>
  section([
    {
      id: id("cols"),
      type: "columns",
      content: { preset: "2" },
      settings: { desktop: { display: "grid", columns: 2, gap: "32px" }, mobile: { columns: 1 } },
      children: [
        column([
          element("heading", { text: "Tell us about your trip", tag: "h2" }, {
            desktop: { fontSize: "32px", fontWeight: "700", color: "#0f172a" },
          }),
          element("text", {
            text: "Share a few details and a travel expert will call you back with an itinerary built around your dates, budget and pace.",
          }),
          element("cards", {
            style: "icon",
            items: [
              { icon: "Headphones", title: "Talk to a real person", text: "No bots, no call centres." },
              { icon: "BadgeCheck", title: "No obligation", text: "A quote costs you nothing." },
            ],
          }, { desktop: { columns: 1 }, tablet: { columns: 1 }, mobile: { columns: 1 } }),
        ]),
        column([
          element("enquiryForm", {
            title: "Plan my trip",
            buttonLabel: "Send enquiry",
            source: "enquiry-section",
            successMessage: "Thank you! Our travel experts will call you shortly.",
          }),
        ]),
      ],
    },
  ]);

/* ───────────────────────── page templates ───────────────────────── */

function document(sections: BuilderNode[]): PageDocument {
  return { version: 1, sections };
}

export const HOMEPAGE_TEMPLATE = () =>
  document([
    heroSection(),
    section([element("categoryStrip", { limit: 6 })], {
      desktop: { padding: { top: "0", bottom: "0", left: "16px", right: "16px" } },
    }),
    destinationsSection(),
    packagesSection(),
    whyUsSection(),
    testimonialsSection(),
    blogSection(),
    ctaSection(),
  ]);

export const LANDING_TEMPLATE = () =>
  document([
    heroSection(),
    packagesSection(),
    whyUsSection(),
    enquirySection(),
    faqSection(),
    ctaSection(),
  ]);

export const CONTACT_TEMPLATE = () =>
  document([
    section([
      element("heading", { text: "Contact us", tag: "h1" }, {
        desktop: { fontSize: "40px", fontWeight: "700", color: "#0f172a", textAlign: "center" },
      }),
      element("text", { text: "We reply to every enquiry within one working day." }, {
        desktop: { textAlign: "center" },
      }),
    ]),
    enquirySection(),
    faqSection(),
  ]);

export const GENERIC_TEMPLATE = () =>
  document([
    section([
      element("heading", { text: "Page title", tag: "h1" }, {
        desktop: { fontSize: "40px", fontWeight: "700", color: "#0f172a" },
      }),
      element("richText", { html: "<p>Start writing here.</p>" }),
    ]),
  ]);

export const DESTINATION_TEMPLATE = () =>
  document([
    heroSection(),
    packagesSection(),
    section([
      element("imageText", {
        image:
          "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80",
        alt: "Destination highlight",
        title: "About this destination",
        text: "Describe the destination, the best time to visit and what makes it worth the trip.",
        imagePosition: "left",
      }),
    ]),
    faqSection(),
    ctaSection(),
  ]);

export type BuiltInTemplate = {
  name: string;
  slug: string;
  kind: "page" | "section";
  category: string;
  description: string;
  content: PageDocument;
};

/** Everything seeded into the template library on first run. */
export function builtInTemplates(): BuiltInTemplate[] {
  return [
    {
      name: "Homepage",
      slug: "homepage",
      kind: "page",
      category: "Pages",
      description: "The layout this site shipped with — hero, destinations, packages, trust, reviews, blog and a call to action.",
      content: HOMEPAGE_TEMPLATE(),
    },
    {
      name: "Landing page",
      slug: "landing",
      kind: "page",
      category: "Pages",
      description: "A campaign page: hero, packages, why us, FAQ and a call to action.",
      content: LANDING_TEMPLATE(),
    },
    {
      name: "Destination page",
      slug: "destination",
      kind: "page",
      category: "Pages",
      description: "Hero, the packages for that destination, an about block and FAQs.",
      content: DESTINATION_TEMPLATE(),
    },
    {
      name: "Contact page",
      slug: "contact",
      kind: "page",
      category: "Pages",
      description: "An enquiry form wired to the CRM, plus FAQs.",
      content: CONTACT_TEMPLATE(),
    },
    {
      name: "Generic page",
      slug: "generic",
      kind: "page",
      category: "Pages",
      description: "A heading and a block of text — for About, Terms or Privacy.",
      content: GENERIC_TEMPLATE(),
    },

    { name: "Hero — travel", slug: "hero-travel", kind: "section", category: "Hero", description: "Full-bleed hero with a badge and two calls to action.", content: document([heroSection()]) },
    { name: "Destination grid", slug: "destination-grid", kind: "section", category: "Travel", description: "Featured destinations, loaded live from the catalogue.", content: document([destinationsSection()]) },
    { name: "Package grid", slug: "package-grid", kind: "section", category: "Travel", description: "Featured packages, loaded live from the catalogue.", content: document([packagesSection()]) },
    { name: "Why choose us", slug: "why-us", kind: "section", category: "Marketing", description: "Four icon cards covering the usual trust points.", content: document([whyUsSection()]) },
    { name: "Testimonials", slug: "testimonials", kind: "section", category: "Marketing", description: "Published reviews from the database.", content: document([testimonialsSection()]) },
    { name: "Travel guides", slug: "blog-grid", kind: "section", category: "Travel", description: "The latest posts from the blog.", content: document([blogSection()]) },
    { name: "CTA — enquiry", slug: "cta-enquiry", kind: "section", category: "Marketing", description: "A coloured call-to-action band.", content: document([ctaSection()]) },
    { name: "Enquiry — two column", slug: "enquiry-two-column", kind: "section", category: "Marketing", description: "Copy on one side, a CRM-connected enquiry form on the other.", content: document([enquirySection()]) },
    { name: "FAQ", slug: "faq", kind: "section", category: "Content", description: "Questions and answers, with FAQ structured data.", content: document([faqSection()]) },
  ];
}
