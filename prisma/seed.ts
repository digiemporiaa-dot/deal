import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { UserRole } from "../types/db-enums";

/** Serialize a string array for storage in a SQLite `String` column (JSON-encoded). */
const list = (values: string[]) => JSON.stringify(values);

const prisma = new PrismaClient();

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("🌱 Seeding Vacationdeal database...");

  // ── Clear existing data (safe order) ───────────────────────
  await prisma.leadNote.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.itineraryDay.deleteMany();
  await prisma.packageInclusion.deleteMany();
  await prisma.packageExclusion.deleteMany();
  await prisma.packageHotel.deleteMany();
  await prisma.packageActivity.deleteMany();
  await prisma.packageImage.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.travelPackage.deleteMany();
  await prisma.destinationImage.deleteMany();
  await prisma.destination.deleteMany();
  await prisma.packageCategory.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.blogCategory.deleteMany();
  await prisma.page.deleteMany();
  await prisma.media.deleteMany();

  // ── Admin + team users ─────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@vacationdeal.test";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "SUPER_ADMIN", isActive: true },
    create: {
      name: "Site Administrator",
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  const team: Array<[string, string, UserRole]> = [
    ["Priya Content", "content@vacationdeal.test", "CONTENT_MANAGER"],
    ["Rahul Bookings", "bookings@vacationdeal.test", "BOOKING_MANAGER"],
  ];
  for (const [name, email, role] of team) {
    await prisma.user.upsert({
      where: { email },
      update: { role },
      create: { name, email, role, passwordHash, isActive: true },
    });
  }

  // ── Categories ─────────────────────────────────────────────
  const categoryNames = [
    "Honeymoon",
    "Family",
    "Adventure",
    "Beach",
    "Luxury",
    "Group Tours",
  ];
  const categories: Awaited<ReturnType<typeof prisma.packageCategory.create>>[] = [];
  for (const name of categoryNames) {
    categories.push(
      await prisma.packageCategory.create({
        data: { name, slug: slugify(name), description: `${name} holiday packages` },
      }),
    );
  }
  const catBy = (n: string) => categories.find((c) => c.name === n)!.id;

  // ── Destinations ───────────────────────────────────────────
  const destData = [
    { name: "Dubai", country: "United Arab Emirates", city: "Dubai", cover: "photo-1512453979798-5ea266f8880c", featured: true, desc: "Futuristic skylines, golden deserts and world-class shopping." },
    { name: "Bali", country: "Indonesia", city: "Denpasar", cover: "photo-1537996194471-e657df975ab4", featured: true, desc: "Emerald rice terraces, sacred temples and surf beaches." },
    { name: "Maldives", country: "Maldives", city: "Malé", cover: "photo-1514282401047-d79a71a590e8", featured: true, desc: "Overwater villas above impossibly blue lagoons." },
    { name: "Thailand", country: "Thailand", city: "Bangkok", cover: "photo-1528181304800-259b08848526", featured: true, desc: "Buzzing street markets, island escapes and grand temples." },
    { name: "Switzerland", country: "Switzerland", city: "Interlaken", cover: "photo-1530122037265-a5f1f91d3b99", featured: false, desc: "Snow-capped Alps, glacier trains and lakeside towns." },
    { name: "Singapore", country: "Singapore", city: "Singapore", cover: "photo-1525625293386-3f8f99389edd", featured: false, desc: "A garden city of futuristic architecture and food streets." },
    { name: "Kerala", country: "India", state: "Kerala", city: "Kochi", cover: "photo-1602216056096-3b40cc0c9944", featured: true, desc: "Backwaters, houseboats and lush tea-covered hills." },
    { name: "Paris", country: "France", city: "Paris", cover: "photo-1502602898657-3e91760cbb34", featured: false, desc: "The city of light, art, romance and timeless cafés." },
  ];

  const destinations: Awaited<ReturnType<typeof prisma.destination.create>>[] = [];
  for (const d of destData) {
    const dest = await prisma.destination.create({
      data: {
        name: d.name,
        slug: slugify(d.name),
        country: d.country,
        state: (d as { state?: string }).state ?? null,
        city: d.city,
        shortDescription: d.desc,
        description: `${d.desc}\n\n${d.name} is one of our most-loved destinations. Our travel experts craft flexible itineraries covering the best experiences, comfortable stays and seamless transfers so you can simply relax and enjoy.`,
        coverImage: img(d.cover),
        bestTimeToVisit: "October to March",
        travelInformation: "Valid passport and visa required for international destinations. Our team assists with visa documentation.",
        highlights: list(["Handpicked hotels", "Private transfers", "Expert local guides", "24x7 on-trip support"]),
        isFeatured: d.featured,
        isPublished: true,
        seoTitle: `${d.name} Tour Packages | Vacationdeal`,
        seoDescription: d.desc,
        images: {
          create: [
            { url: img(d.cover, 1600), alt: `${d.name} view`, sortOrder: 0 },
          ],
        },
        faqs: {
          create: [
            { question: `What is the best time to visit ${d.name}?`, answer: "October to March offers the most pleasant weather for most travellers.", sortOrder: 0 },
            { question: `Do I need a visa for ${d.name}?`, answer: "Visa requirements depend on your nationality. Our team helps arrange all documentation.", sortOrder: 1 },
          ],
        },
      },
    });
    destinations.push(dest);
  }
  const destBy = (n: string) => destinations.find((x) => x.name === n)!.id;

  // ── Packages (12) ──────────────────────────────────────────
  const pkgData = [
    { name: "Dubai Dazzle — 5 Days", dest: "Dubai", cat: "Luxury", days: 5, nights: 4, price: 65000, discount: 54999, cover: "photo-1512453979798-5ea266f8880c", featured: true },
    { name: "Bali Honeymoon Bliss — 6 Days", dest: "Bali", cat: "Honeymoon", days: 6, nights: 5, price: 72000, discount: 61999, cover: "photo-1537996194471-e657df975ab4", featured: true },
    { name: "Maldives Overwater Escape — 4 Days", dest: "Maldives", cat: "Luxury", days: 4, nights: 3, price: 95000, discount: 84999, cover: "photo-1514282401047-d79a71a590e8", featured: true },
    { name: "Thailand Island Hopper — 7 Days", dest: "Thailand", cat: "Beach", days: 7, nights: 6, price: 58000, discount: 49999, cover: "photo-1528181304800-259b08848526", featured: true },
    { name: "Swiss Alps Grandeur — 8 Days", dest: "Switzerland", cat: "Luxury", days: 8, nights: 7, price: 165000, discount: null, cover: "photo-1530122037265-a5f1f91d3b99", featured: true },
    { name: "Singapore City Lights — 5 Days", dest: "Singapore", cat: "Family", days: 5, nights: 4, price: 62000, discount: 55999, cover: "photo-1525625293386-3f8f99389edd", featured: false },
    { name: "Kerala Backwater Serenity — 6 Days", dest: "Kerala", cat: "Family", days: 6, nights: 5, price: 38000, discount: 32999, cover: "photo-1602216056096-3b40cc0c9944", featured: true },
    { name: "Paris Romance — 5 Days", dest: "Paris", cat: "Honeymoon", days: 5, nights: 4, price: 128000, discount: 114999, cover: "photo-1502602898657-3e91760cbb34", featured: false },
    { name: "Dubai Family Fun — 6 Days", dest: "Dubai", cat: "Family", days: 6, nights: 5, price: 78000, discount: 69999, cover: "photo-1518684079-3c830dcef090", featured: false },
    { name: "Bali Adventure Trail — 7 Days", dest: "Bali", cat: "Adventure", days: 7, nights: 6, price: 68000, discount: 59999, cover: "photo-1518548419970-58e3b4079ab2", featured: false },
    { name: "Thailand Bangkok & Pattaya — 5 Days", dest: "Thailand", cat: "Group Tours", days: 5, nights: 4, price: 42000, discount: 36999, cover: "photo-1563492065599-3520f775eeed", featured: false },
    { name: "Kerala Hills & Houseboat — 5 Days", dest: "Kerala", cat: "Honeymoon", days: 5, nights: 4, price: 34000, discount: 29999, cover: "photo-1593693411515-c20261bcad6e", featured: true },
  ];

  const packages: Awaited<ReturnType<typeof prisma.travelPackage.create>>[] = [];
  for (const p of pkgData) {
    const pkg = await prisma.travelPackage.create({
      data: {
        name: p.name,
        slug: slugify(p.name),
        destinationId: destBy(p.dest),
        categoryId: catBy(p.cat),
        shortDescription: `An unforgettable ${p.days}-day ${p.dest} experience with handpicked stays and curated experiences.`,
        description: `Discover the very best of ${p.dest} on this ${p.days}-day / ${p.nights}-night journey. This package blends iconic sights, authentic local experiences and comfortable accommodation, all backed by 24x7 on-trip support from our travel experts. Every transfer, stay and highlight is carefully arranged so you can travel worry-free.`,
        highlights: list([
          `Explore the best of ${p.dest}`,
          "Handpicked 4★ hotels with breakfast",
          "Private airport transfers",
          "Curated sightseeing & experiences",
        ]),
        durationDays: p.days,
        durationNights: p.nights,
        startingPrice: p.price,
        discountPrice: p.discount ?? null,
        currency: "INR",
        minTravellers: 1,
        maxTravellers: 20,
        featured: p.featured,
        published: true,
        bookingEnabled: true,
        seoTitle: `${p.name} | Vacationdeal`,
        seoDescription: `Book ${p.name} with Vacationdeal. Handpicked stays, private transfers and expert support.`,
        images: {
          create: [
            { url: img(p.cover, 1600), alt: p.name, sortOrder: 0 },
            { url: img(destData.find((d) => d.name === p.dest)!.cover, 1600), alt: `${p.dest} scenery`, sortOrder: 1 },
          ],
        },
        inclusions: {
          create: [
            { text: `${p.nights} nights hotel accommodation` },
            { text: "Daily breakfast" },
            { text: "Airport transfers (private)" },
            { text: "Sightseeing as per itinerary" },
            { text: "24x7 on-trip assistance" },
          ],
        },
        exclusions: {
          create: [
            { text: "International/domestic airfare" },
            { text: "Visa fees (assistance provided)" },
            { text: "Travel insurance" },
            { text: "Personal expenses & tips" },
          ],
        },
        hotels: {
          create: [
            { name: `${p.dest} Grand Hotel`, location: p.dest, roomType: "Deluxe Room", nights: Math.ceil(p.nights / 2), description: "4-star comfort with breakfast." },
            { name: `${p.dest} Riverside Resort`, location: p.dest, roomType: "Premium Room", nights: Math.floor(p.nights / 2), description: "Scenic resort stay." },
          ],
        },
        activities: {
          create: [
            { name: "City highlights tour", description: "Guided tour of the top sights.", price: 0 },
            { name: "Optional adventure add-on", description: "Upgrade with a thrilling local experience.", price: 3500 },
          ],
        },
        faqs: {
          create: [
            { question: "Is this package customizable?", answer: "Yes — every itinerary can be tailored to your dates, budget and preferences.", sortOrder: 0 },
            { question: "What is the booking amount?", answer: "A 25% advance confirms your booking; the balance is due before travel.", sortOrder: 1 },
          ],
        },
        itinerary: {
          create: Array.from({ length: p.days }).map((_, i) => ({
            dayNumber: i + 1,
            title:
              i === 0
                ? `Arrival in ${p.dest}`
                : i === p.days - 1
                  ? `Departure from ${p.dest}`
                  : `${p.dest} Exploration — Day ${i + 1}`,
            description:
              i === 0
                ? `Arrive in ${p.dest}, meet our representative and transfer to your hotel. Evening at leisure.`
                : i === p.days - 1
                  ? `After breakfast, check out and transfer to the airport with wonderful memories.`
                  : `Enjoy a full day of curated sightseeing and experiences in and around ${p.dest}.`,
            activities: i === 0 ? "Arrival & hotel check-in" : "Guided sightseeing",
            meals: "Breakfast",
            hotel: `${p.dest} Grand Hotel`,
            sortOrder: i,
          })),
        },
      },
    });
    packages.push(pkg);
  }
  const pkgBy = (n: string) => packages.find((x) => x.name === n)!;

  // ── Testimonials ───────────────────────────────────────────
  const testimonials = [
    { name: "Ananya & Kabir", rating: 5, review: "Our Bali honeymoon was flawless — every detail was taken care of. Highly recommend Vacationdeal!", dest: "Bali" },
    { name: "The Mehta Family", rating: 5, review: "Singapore with kids was stress-free thanks to the perfect planning. The hotels were fantastic.", dest: "Singapore" },
    { name: "Rohan S.", rating: 5, review: "Maldives exceeded every expectation. The overwater villa was a dream. Worth every rupee.", dest: "Maldives" },
    { name: "Neha Kapoor", rating: 4, review: "Great Dubai trip. Smooth transfers and lovely hotels. Would book again.", dest: "Dubai" },
    { name: "Arjun & Meera", rating: 5, review: "Kerala backwaters were magical. The houseboat stay was the highlight of our year.", dest: "Kerala" },
    { name: "Sameer Khan", rating: 5, review: "Switzerland was a bucket-list trip done right. Seamless and truly premium service.", dest: "Switzerland" },
  ];
  for (const t of testimonials) {
    await prisma.testimonial.create({
      data: {
        customerName: t.name,
        rating: t.rating,
        review: t.review,
        destination: t.dest,
        published: true,
        image: img("photo-1494790108377-be9c29b29330", 200),
      },
    });
  }

  // ── Blog ───────────────────────────────────────────────────
  const blogCat = await prisma.blogCategory.create({
    data: { name: "Travel Tips", slug: "travel-tips" },
  });
  const guideCat = await prisma.blogCategory.create({
    data: { name: "Destination Guides", slug: "destination-guides" },
  });
  const posts = [
    ["10 Things to Do in Dubai on Your First Visit", "Dubai", guideCat.id],
    ["The Ultimate Bali Honeymoon Guide", "Bali", guideCat.id],
    ["Maldives on a Budget: Is It Possible?", "Maldives", blogCat.id],
    ["Best Time to Visit Thailand", "Thailand", blogCat.id],
    ["A Week in Switzerland: Sample Itinerary", "Switzerland", guideCat.id],
    ["Kerala Backwaters: Everything You Need to Know", "Kerala", guideCat.id],
    ["Packing Checklist for International Travel", "General", blogCat.id],
    ["How to Save on Group Tour Packages", "General", blogCat.id],
  ];
  for (const [title, place, categoryId] of posts) {
    await prisma.blogPost.create({
      data: {
        title,
        slug: slugify(title),
        excerpt: `Expert tips and insights about ${place} to help you plan the perfect trip.`,
        content: `<p>${title}. In this guide, our travel experts share everything you need to know to plan a memorable trip.</p><p>From the best time to go, to where to stay and what to experience, we have curated practical, up-to-date advice based on real traveller journeys.</p><h2>Plan with confidence</h2><p>Reach out to our team for a tailor-made itinerary and exclusive deals.</p>`,
        coverImage: img("photo-1476514525535-07fb3b4ae5f1"),
        tags: list([place, "travel"]),
        status: "PUBLISHED",
        featured: title.includes("Dubai") || title.includes("Bali"),
        categoryId,
        authorId: admin.id,
        publishedAt: new Date(),
        seoTitle: `${title} | Vacationdeal Blog`,
        seoDescription: `Read ${title} on the Vacationdeal travel blog.`,
      },
    });
  }

  // ── Coupons ────────────────────────────────────────────────
  await prisma.coupon.create({
    data: { code: "WELCOME10", discountType: "PERCENTAGE", discountAmount: 10, maxDiscount: 8000, active: true, usageLimit: 500 },
  });
  await prisma.coupon.create({
    data: { code: "FLAT5000", discountType: "FIXED", discountAmount: 5000, minAmount: 50000, active: true },
  });

  // ── Customers, Bookings, Payments ──────────────────────────
  const cust1 = await prisma.customer.create({
    data: { name: "Vikram Rao", email: "vikram@example.com", phone: "9876500011", whatsapp: "9876500011", country: "India", city: "Bengaluru" },
  });
  const cust2 = await prisma.customer.create({
    data: { name: "Sara Iyer", email: "sara@example.com", phone: "9876500022", country: "India", city: "Chennai" },
  });

  const b1pkg = pkgBy("Dubai Dazzle — 5 Days");
  const booking1 = await prisma.booking.create({
    data: {
      bookingNumber: "VD-20260801-1001",
      customerId: cust1.id,
      packageId: b1pkg.id,
      travelDate: new Date("2026-11-15"),
      adults: 2,
      children: 0,
      rooms: 1,
      baseAmount: 130000,
      discountAmount: 20002,
      taxAmount: 5500,
      totalAmount: 115498,
      advanceAmount: 28875,
      remainingAmount: 86623,
      currency: "INR",
      status: "CONFIRMED",
      paymentStatus: "PAID",
    },
  });
  await prisma.payment.create({
    data: {
      bookingId: booking1.id,
      razorpayOrderId: "order_seed_0001",
      razorpayPaymentId: "pay_seed_0001",
      amount: 28875,
      currency: "INR",
      status: "PAID",
      paymentMethod: "card",
    },
  });

  const b2pkg = pkgBy("Kerala Backwater Serenity — 6 Days");
  await prisma.booking.create({
    data: {
      bookingNumber: "VD-20260802-1002",
      customerId: cust2.id,
      packageId: b2pkg.id,
      travelDate: new Date("2026-12-05"),
      adults: 2,
      children: 1,
      rooms: 1,
      baseAmount: 95000,
      discountAmount: 15000,
      taxAmount: 4000,
      totalAmount: 84000,
      advanceAmount: 21000,
      remainingAmount: 63000,
      currency: "INR",
      status: "PAYMENT_PENDING",
      paymentStatus: "PENDING",
    },
  });

  // ── Leads ──────────────────────────────────────────────────
  const leadSeed = [
    { name: "Deepak Nair", phone: "9811100011", destination: "Maldives", status: "NEW" as const, message: "Looking for a 5-day Maldives honeymoon in December." },
    { name: "Fatima Sheikh", phone: "9811100022", destination: "Dubai", status: "CONTACTED" as const, message: "Family of 4, budget around 3L." },
    { name: "Gaurav Malhotra", phone: "9811100033", destination: "Switzerland", status: "FOLLOW_UP" as const, message: "Need a premium Swiss + Paris combo." },
    { name: "Isha Verma", phone: "9811100044", destination: "Bali", status: "QUALIFIED" as const, message: "Honeymoon, first week of Jan." },
  ];
  for (const l of leadSeed) {
    const lead = await prisma.lead.create({
      data: {
        name: l.name,
        phone: l.phone,
        whatsapp: l.phone,
        destination: l.destination,
        message: l.message,
        status: l.status,
        source: "website",
        travellers: 2,
        budget: "₹1L – ₹3L",
      },
    });
    if (l.status !== "NEW") {
      await prisma.leadNote.create({
        data: { leadId: lead.id, authorId: admin.id, body: "Called the customer, sharing options over WhatsApp." },
      });
    }
  }

  // ── CMS Pages ──────────────────────────────────────────────
  await prisma.page.create({
    data: {
      title: "About Us",
      slug: "about",
      content: "<p>Vacationdeal is a full-service travel agency crafting personalised holidays across the world. With handpicked stays, expert planning and 24x7 support, we turn travel dreams into effortless journeys.</p>",
      status: "PUBLISHED",
      seoTitle: "About Vacationdeal",
      seoDescription: "Learn about Vacationdeal — your trusted travel partner.",
    },
  });

  // ── Site settings ──────────────────────────────────────────
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      data: {
        siteName: "Vacationdeal",
        tagline: "Crafted journeys to the places you have always dreamed of.",
        email: "hello@vacationdeal.test",
        phone: "+91 98765 43210",
        whatsapp: "919876543210",
        address: "123 Marine Drive, Mumbai, India",
        businessHours: "Mon–Sat, 10:00 AM – 7:00 PM",
        currency: "INR",
        taxPercent: 5,
        advancePercent: 25,
        social: { instagram: "https://instagram.com", facebook: "https://facebook.com", twitter: "", youtube: "", linkedin: "" },
        analytics: { googleAnalyticsId: "", metaPixelId: "", googleTagManagerId: "" },
      },
    },
  });

  console.log("✅ Seed complete.");
  console.log(`   Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`   ${destinations.length} destinations, ${packages.length} packages seeded.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
