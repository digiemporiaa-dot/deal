import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/crm";

// ── Shared primitives ────────────────────────────────────────
const phoneSchema = z
  .string()
  .min(7, "Enter a valid phone number")
  .max(20)
  .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number");

/**
 * A URL that may be absolute (https://cdn/…) or a site-relative path
 * (/uploads/…), which is what the media library produces.
 */
const optionalImage = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Enter a valid image URL or path")
  .or(z.literal(""))
  .optional();

/**
 * Password rules for admin accounts: long enough to resist offline cracking
 * and mixed enough to rule out "password1".
 */
export const strongPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That password is too long")
  .refine((v) => /[a-z]/.test(v), "Include a lowercase letter")
  .refine((v) => /[A-Z]/.test(v), "Include an uppercase letter")
  .refine((v) => /[0-9]/.test(v), "Include a number");

// ── Lead / enquiry ───────────────────────────────────────────
export const leadSchema = z.object({
  name: z.string().min(2, "Please enter your name").max(120),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  phone: phoneSchema,
  whatsapp: z.string().max(20).optional().or(z.literal("")),
  destination: z.string().max(120).optional().or(z.literal("")),
  travelDate: z.string().optional().or(z.literal("")),
  travellers: z.coerce.number().int().min(1).max(100).optional(),
  budget: z.string().max(60).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  source: z.string().max(60).default("website"),
  country: z.string().max(80).optional().or(z.literal("")),
  returnDate: z.string().optional().or(z.literal("")),
  adults: z.coerce.number().int().min(1).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
  // Attribution submitted by the browser is only a fallback: the server reads
  // the first-touch cookie set by the middleware and that wins.
  utm: z
    .object({
      utm_source: z.string().max(200).optional(),
      utm_medium: z.string().max(200).optional(),
      utm_campaign: z.string().max(200).optional(),
      utm_term: z.string().max(200).optional(),
      utm_content: z.string().max(200).optional(),
      gclid: z.string().max(200).optional(),
      fbclid: z.string().max(200).optional(),
      landingPage: z.string().max(500).optional(),
      referrer: z.string().max(500).optional(),
    })
    .partial()
    .optional(),
});
export type LeadInput = z.infer<typeof leadSchema>;

// ── Auth ─────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Booking ──────────────────────────────────────────────────
export const bookingSchema = z.object({
  packageId: z.string().min(1, "Package is required"),
  travelDate: z.string().min(1, "Select a travel date"),
  adults: z.coerce.number().int().min(1, "At least one adult").max(50),
  children: z.coerce.number().int().min(0).max(50).default(0),
  rooms: z.coerce.number().int().min(1).max(25).default(1),
  couponCode: z.string().max(40).optional().or(z.literal("")),
  specialRequests: z.string().max(2000).optional().or(z.literal("")),
  customer: z.object({
    name: z.string().min(2, "Enter your full name").max(120),
    email: z.string().email("Enter a valid email"),
    phone: phoneSchema,
    whatsapp: z.string().max(20).optional().or(z.literal("")),
    country: z.string().max(80).optional().or(z.literal("")),
    city: z.string().max(80).optional().or(z.literal("")),
  }),
});
export type BookingInput = z.infer<typeof bookingSchema>;

// ── Nested repeater sub-schemas (admin package form) ─────────
const itineraryDaySchema = z.object({
  dayNumber: z.coerce.number().int().min(1),
  title: z.string().min(1, "Day title is required"),
  description: z.string().default(""),
  activities: z.string().optional().default(""),
  meals: z.string().optional().default(""),
  hotel: z.string().optional().default(""),
  transfers: z.string().optional().default(""),
});

const hotelSchema = z.object({
  name: z.string().min(1, "Hotel name is required"),
  location: z.string().optional().default(""),
  roomType: z.string().optional().default(""),
  nights: z.coerce.number().int().min(1).default(1),
  description: z.string().optional().default(""),
});

const activitySchema = z.object({
  name: z.string().min(1, "Activity name is required"),
  description: z.string().optional().default(""),
  price: z.coerce.number().min(0).optional(),
});

const faqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
});

const imageSchema = z.object({
  url: z.string().min(1, "Image URL is required"),
  alt: z.string().optional().default(""),
});

// ── Package (admin create/edit) ──────────────────────────────
export const packageSchema = z.object({
  name: z.string().min(2, "Package name is required").max(160),
  slug: z.string().min(2).max(160).optional().or(z.literal("")),
  destinationId: z.string().min(1, "Choose a destination"),
  categoryId: z.string().optional().or(z.literal("")),
  shortDescription: z.string().min(1, "Short description is required").max(300),
  description: z.string().min(1, "Description is required"),
  durationDays: z.coerce.number().int().min(1),
  durationNights: z.coerce.number().int().min(0),
  startingPrice: z.coerce.number().min(0, "Price must be positive"),
  discountPrice: z.coerce.number().min(0).optional(),
  currency: z.string().default("INR"),
  minTravellers: z.coerce.number().int().min(1).default(1),
  maxTravellers: z.coerce.number().int().min(1).default(20),
  featured: z.coerce.boolean().default(false),
  published: z.coerce.boolean().default(true),
  bookingEnabled: z.coerce.boolean().default(true),
  seoTitle: z.string().max(160).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(60)).max(20).default([]),
  highlights: z.array(z.string()).default([]),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  images: z.array(imageSchema).default([]),
  itinerary: z.array(itineraryDaySchema).default([]),
  hotels: z.array(hotelSchema).default([]),
  activities: z.array(activitySchema).default([]),
  faqs: z.array(faqSchema).default([]),
});
export type PackageInput = z.infer<typeof packageSchema>;

// ── Destination (admin create/edit) ──────────────────────────
export const destinationSchema = z.object({
  name: z.string().min(2, "Destination name is required").max(160),
  slug: z.string().optional().or(z.literal("")),
  country: z.string().min(1, "Country is required"),
  state: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  shortDescription: z.string().min(1, "Short description is required").max(300),
  description: z.string().min(1, "Description is required"),
  coverImage: optionalImage,
  bestTimeToVisit: z.string().optional().or(z.literal("")),
  travelInformation: z.string().optional().or(z.literal("")),
  highlights: z.array(z.string()).default([]),
  isFeatured: z.coerce.boolean().default(false),
  isPublished: z.coerce.boolean().default(true),
  seoTitle: z.string().max(160).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
  images: z.array(imageSchema).default([]),
  faqs: z.array(faqSchema).default([]),
});
export type DestinationInput = z.infer<typeof destinationSchema>;

// ── Blog post ────────────────────────────────────────────────
export const blogSchema = z.object({
  title: z.string().min(2, "Title is required").max(200),
  slug: z.string().optional().or(z.literal("")),
  excerpt: z.string().max(300).optional().or(z.literal("")),
  content: z.string().min(1, "Content is required"),
  coverImage: optionalImage,
  tags: z.array(z.string()).default([]),
  categoryId: z.string().optional().or(z.literal("")),
  // Editorial links used by the internal-linking engine.
  destinationId: z.string().optional().or(z.literal("")),
  packageId: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  featured: z.coerce.boolean().default(false),
  seoTitle: z.string().max(160).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
});
export type BlogInput = z.infer<typeof blogSchema>;

// ── Testimonial ──────────────────────────────────────────────
export const testimonialSchema = z.object({
  customerName: z.string().min(2, "Name is required").max(120),
  image: optionalImage,
  rating: z.coerce.number().int().min(1).max(5).default(5),
  review: z.string().min(1, "Review is required"),
  packageId: z.string().optional().or(z.literal("")),
  destination: z.string().optional().or(z.literal("")),
  published: z.coerce.boolean().default(true),
});
export type TestimonialInput = z.infer<typeof testimonialSchema>;

// ── Coupon ───────────────────────────────────────────────────
export const couponSchema = z.object({
  code: z.string().min(2, "Code is required").max(40).toUpperCase(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  discountAmount: z.coerce.number().min(0),
  minAmount: z.coerce.number().min(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional(),
  startDate: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  usageLimit: z.coerce.number().int().min(0).optional(),
  active: z.coerce.boolean().default(true),
  packageIds: z.array(z.string()).default([]),
});
export type CouponInput = z.infer<typeof couponSchema>;

// ── Media library ────────────────────────────────────────────
export const mediaMetaSchema = z.object({
  alt: z.string().trim().max(300).optional().or(z.literal("")),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  caption: z.string().trim().max(500).optional().or(z.literal("")),
  folder: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/i, "Use letters, numbers and dashes only")
    .optional()
    .or(z.literal("")),
});
export type MediaMetaInput = z.infer<typeof mediaMetaSchema>;

export const mediaQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  folder: z.string().trim().max(60).optional(),
  type: z.enum(["image", "all"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(48),
});

// ── SEO panel (shared by every content form) ─────────────────
export const seoPanelSchema = z.object({
  seoTitle: z.string().trim().max(160).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(320).optional().or(z.literal("")),
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Enter a full URL or a path starting with /")
    .optional()
    .or(z.literal("")),
  focusKeyword: z.string().trim().max(120).optional().or(z.literal("")),
  ogTitle: z.string().trim().max(160).optional().or(z.literal("")),
  ogDescription: z.string().trim().max(320).optional().or(z.literal("")),
  ogImage: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Enter a valid image URL or path")
    .optional()
    .or(z.literal("")),
  twitterTitle: z.string().trim().max(160).optional().or(z.literal("")),
  twitterDescription: z.string().trim().max(320).optional().or(z.literal("")),
  twitterImage: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Enter a valid image URL or path")
    .optional()
    .or(z.literal("")),
  robotsIndex: z.coerce.boolean().default(true),
  robotsFollow: z.coerce.boolean().default(true),
  schemaType: z.string().trim().max(60).optional().or(z.literal("")),
  schemaJson: z.string().trim().max(20_000).optional().or(z.literal("")),
});
export type SeoPanelInput = z.infer<typeof seoPanelSchema>;

// ── Admin list query parameters ──────────────────────────────
// Search params arrive as untrusted strings; parse them before they reach a
// Prisma `where`, so a hand-edited URL cannot widen a query.

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});

export const leadQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  source: z.string().trim().max(60).optional(),
  priority: z.string().trim().max(20).optional(),
  destination: z.string().trim().max(120).optional(),
  owner: z.string().trim().max(60).optional(),
  budget: z.string().trim().max(60).optional(),
  due: z.enum(["1", "overdue", "today", "upcoming"]).optional(),
  /** How warm the lead is, from the stored score. */
  band: z.enum(["HOT", "WARM", "COLD"]).optional(),
  /** One tag; matched against the JSON-encoded tag list. */
  tag: z.string().trim().max(40).optional(),
  /** "open" hides won, lost and junk; "closed" shows only those. */
  state: z.enum(["open", "closed"]).optional(),
  from: dateString,
  to: dateString,
  sort: z.enum(["newest", "oldest", "followup", "activity", "score"]).default("followup"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});
export type LeadQuery = z.infer<typeof leadQuerySchema>;

// ── CRM: follow-ups, conversion, qualification ───────────────

/**
 * A date-time from a form. Accepts both `YYYY-MM-DD` and the
 * `YYYY-MM-DDTHH:mm` an <input type="datetime-local"> produces, and rejects
 * anything that is not a real instant — an invalid Date reaching Prisma is a
 * 500, not a validation error.
 */
const dateTimeString = z
  .string()
  .trim()
  .min(1, "Pick a date")
  .max(40)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date");

export const followUpSchema = z.object({
  leadId: z.string().trim().min(1).max(40),
  dueAt: dateTimeString,
  type: z.enum(["CALL", "WHATSAPP", "EMAIL", "MEETING", "TASK"]).default("CALL"),
  title: z.string().trim().min(2, "Say what the follow-up is for").max(200),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Verified against a real active user server-side; never trusted as given. */
  assignedToId: z.string().trim().max(40).optional().or(z.literal("")),
});
export type FollowUpInput = z.infer<typeof followUpSchema>;

export const completeFollowUpSchema = z.object({
  id: z.string().trim().min(1).max(40),
  outcome: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["DONE", "CANCELLED"]).default("DONE"),
});

export const rescheduleFollowUpSchema = z.object({
  id: z.string().trim().min(1).max(40),
  dueAt: dateTimeString,
});

/** Extra qualification detail captured on the lead workspace. */
export const leadQualificationSchema = z.object({
  destination: z.string().trim().max(120).optional().or(z.literal("")),
  destinationId: z.string().trim().max(40).optional().or(z.literal("")),
  packageId: z.string().trim().max(40).optional().or(z.literal("")),
  travelDate: z.string().trim().max(40).optional().or(z.literal("")),
  returnDate: z.string().trim().max(40).optional().or(z.literal("")),
  adults: z.coerce.number().int().min(0).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
  rooms: z.coerce.number().int().min(0).max(50).optional(),
  budget: z.string().trim().max(60).optional().or(z.literal("")),
  tripType: z.string().trim().max(40).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
});
export type LeadQualificationInput = z.infer<typeof leadQualificationSchema>;

/** Moving a lead through the pipeline, with the reason a close needs. */
export const leadStatusSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    status: z.enum(LEAD_STATUSES),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((value) => value.status !== "LOST" || Boolean(value.reason), {
    message: "Say why the lead was lost",
    path: ["reason"],
  });

export const bookingQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  payment: z.string().trim().max(40).optional(),
  destination: z.string().trim().max(60).optional(),
  /** "1" restricts to trips that have not departed. */
  upcoming: z.enum(["1"]).optional(),
  from: dateString,
  to: dateString,
  sort: z.enum(["newest", "oldest", "travel", "amount"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});
export type BookingQuery = z.infer<typeof bookingQuerySchema>;

export const paymentQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  method: z.string().trim().max(40).optional(),
  from: dateString,
  to: dateString,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});
export type PaymentQuery = z.infer<typeof paymentQuerySchema>;

export const customerQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  sort: z.enum(["newest", "name", "spend", "bookings"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});
export type CustomerQuery = z.infer<typeof customerQuerySchema>;

/** Shared shape for the catalogue and content lists. */
export const catalogueQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["published", "draft", "featured"]).optional(),
  destination: z.string().trim().max(60).optional(),
  sort: z.enum(["newest", "updated", "name", "price", "bookings"]).default("updated"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});
export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

export const activityQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  user: z.string().trim().max(60).optional(),
  action: z.string().trim().max(40).optional(),
  entity: z.string().trim().max(40).optional(),
  from: dateString,
  to: dateString,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const dashboardQuerySchema = z.object({
  range: z
    .enum(["today", "yesterday", "7d", "30d", "month", "last_month", "90d", "year", "all", "custom"])
    .default("30d"),
  from: dateString,
  to: dateString,
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
