import { z } from "zod";

// ── Shared primitives ────────────────────────────────────────
const phoneSchema = z
  .string()
  .min(7, "Enter a valid phone number")
  .max(20)
  .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number");

const optionalUrl = z.string().url("Enter a valid URL").or(z.literal("")).optional();

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
  coverImage: optionalUrl,
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
  coverImage: optionalUrl,
  tags: z.array(z.string()).default([]),
  categoryId: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  featured: z.coerce.boolean().default(false),
  seoTitle: z.string().max(160).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
});
export type BlogInput = z.infer<typeof blogSchema>;

// ── Testimonial ──────────────────────────────────────────────
export const testimonialSchema = z.object({
  customerName: z.string().min(2, "Name is required").max(120),
  image: optionalUrl,
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
