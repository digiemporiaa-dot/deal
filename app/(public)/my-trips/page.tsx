import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, Users, ArrowRight, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-session";
import { CustomerLogin } from "@/components/site/CustomerLogin";
import { CustomerLogoutButton } from "@/components/site/CustomerLogoutButton";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "My Trips", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  REFUNDED: "bg-slate-100 text-slate-600",
};

export default async function MyTripsPage() {
  const customerId = await getCustomerSession();
  if (!customerId) return <CustomerLogin />;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: {
        orderBy: { travelDate: "desc" },
        include: {
          package: {
            select: {
              name: true,
              slug: true,
              durationDays: true,
              durationNights: true,
              destination: { select: { name: true } },
              images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
            },
          },
        },
      },
    },
  });

  if (!customer) return <CustomerLogin />;

  const now = new Date();
  const upcoming = customer.bookings.filter((b) => new Date(b.travelDate) >= now);
  const past = customer.bookings.filter((b) => new Date(b.travelDate) < now);

  const totalDue = customer.bookings.reduce((sum, b) => sum + toNumber(b.remainingAmount), 0);

  const Card = ({ booking }: { booking: (typeof customer.bookings)[number] }) => {
    const image = booking.package?.images?.[0];
    return (
      <Link
        href={`/my-trips/${booking.bookingNumber}`}
        className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
      >
        <div className="relative hidden h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:block">
          {image && (
            <Image src={image.url} alt={image.alt || booking.package.name} fill sizes="128px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-xs text-slate-400">{booking.bookingNumber}</p>
              <h3 className="mt-0.5 truncate font-display text-lg font-semibold text-slate-900 group-hover:text-brand-700">
                {booking.package?.name}
              </h3>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[booking.paymentStatus] ?? "bg-slate-100 text-slate-600"}`}>
              {booking.paymentStatus}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {booking.package?.destination && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {booking.package.destination.name}</span>
            )}
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(booking.travelDate)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {booking.adults + booking.children} traveller(s)</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-semibold text-slate-900">{formatCurrency(toNumber(booking.totalAmount))}</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
              View details <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="container-page py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">
            Welcome back, {customer.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-slate-600">
            {customer.bookings.length} booking{customer.bookings.length === 1 ? "" : "s"} with us
          </p>
        </div>
        <CustomerLogoutButton />
      </div>

      {totalDue > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Wallet className="h-5 w-5 text-amber-600" />
          <p className="text-sm font-medium text-amber-900">
            {formatCurrency(totalDue)} balance remaining across your bookings.
          </p>
        </div>
      )}

      {customer.bookings.length === 0 && (
        <div className="rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-slate-600">You don&rsquo;t have any bookings yet.</p>
          <Link href="/packages" className="mt-4 inline-flex h-11 items-center rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700">
            Explore packages
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Upcoming trips</h2>
          <div className="space-y-4">
            {upcoming.map((b) => <Card key={b.id} booking={b} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Past trips</h2>
          <div className="space-y-4 opacity-90">
            {past.map((b) => <Card key={b.id} booking={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}
