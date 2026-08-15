import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CalendarDays, Users, MapPin, CheckCircle2, XCircle,
  FileText, Printer, Wallet, Phone, MessageCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-session";
import { getSettings } from "@/lib/settings";
import { ItineraryTimeline } from "@/components/site/ItineraryTimeline";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Booking details", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ bookingNumber: string }> };

export default async function MyTripDetailPage({ params }: Props) {
  const { bookingNumber } = await params;
  const customerId = await getCustomerSession();
  if (!customerId) notFound();

  const booking = await prisma.booking.findUnique({
    where: { bookingNumber: bookingNumber.toUpperCase() },
    include: {
      customer: true,
      payments: { orderBy: { createdAt: "desc" } },
      package: {
        include: {
          destination: { select: { name: true } },
          itinerary: { orderBy: { sortOrder: "asc" } },
          inclusions: true,
          exclusions: true,
        },
      },
    },
  });

  // A signed-in customer may only open their own booking.
  if (!booking || booking.customerId !== customerId) notFound();

  const settings = await getSettings();
  const documents = await prisma.salesDocument.findMany({
    where: {
      OR: [{ bookingId: booking.id }, { customerEmail: booking.customer.email }],
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, number: true, status: true, createdAt: true },
  });

  const total = toNumber(booking.totalAmount);
  const paid = booking.payments
    .filter((p) => p.status === "PAID" || p.status === "SUCCESS")
    .reduce((s, p) => s + toNumber(p.amount), 0);
  const balance = Math.max(toNumber(booking.remainingAmount) || total - paid, 0);

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/my-trips" className="mb-5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All my trips
      </Link>

      {/* Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="font-mono text-xs text-slate-400">{booking.bookingNumber}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          {booking.package?.name}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
          {booking.package?.destination && (
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand-500" /> {booking.package.destination.name}</span>
          )}
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-brand-500" /> {formatDate(booking.travelDate)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-brand-500" />
            {booking.adults} adult{booking.adults === 1 ? "" : "s"}
            {booking.children > 0 && `, ${booking.children} child${booking.children === 1 ? "" : "ren"}`}
            {booking.rooms > 0 && ` · ${booking.rooms} room${booking.rooms === 1 ? "" : "s"}`}
          </span>
        </div>

        {booking.specialRequests && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold">Your request: </span>{booking.specialRequests}
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Payment</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(total)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Paid</p>
            <p className="mt-1 text-lg font-bold text-emerald-600">{formatCurrency(paid || toNumber(booking.advanceAmount))}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Balance</p>
            <p className={`mt-1 text-lg font-bold ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {formatCurrency(balance)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{booking.paymentStatus}</p>
          </div>
        </div>

        {booking.payments.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment history</p>
            <ul className="space-y-2">
              {booking.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{formatDate(p.createdAt)}{p.paymentMethod ? ` · ${p.paymentMethod}` : ""}</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{formatCurrency(toNumber(p.amount))}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "PAID" || p.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {p.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {balance > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-4">
            <Wallet className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="flex-1 text-sm text-amber-900">
              {formatCurrency(balance)} is still due. Contact us to pay the balance.
            </p>
            {settings.whatsapp && (
              <a
                href={buildWhatsAppLink(settings.whatsapp, `Hi, I'd like to pay the balance for booking ${booking.bookingNumber}.`)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-sm font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp us
              </a>
            )}
          </div>
        )}
      </div>

      {/* Documents */}
      {documents.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Your documents</h2>
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <span className="inline-flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-brand-500" />
                  <span className="font-medium text-slate-900">
                    {d.kind === "INVOICE" ? "Invoice" : "Quotation"} {d.number}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(d.createdAt)}</span>
                </span>
                <Link
                  href={`/my-trips/documents/${d.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5" /> View / download
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Itinerary */}
      {booking.package?.itinerary && booking.package.itinerary.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-5 font-semibold text-slate-900">Your day-by-day itinerary</h2>
          <ItineraryTimeline days={booking.package.itinerary} />
        </div>
      )}

      {/* Inclusions */}
      {booking.package && (booking.package.inclusions.length > 0 || booking.package.exclusions.length > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {booking.package.inclusions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-3 font-semibold text-slate-900">What&rsquo;s included</h2>
              <ul className="space-y-2">
                {booking.package.inclusions.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {i.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {booking.package.exclusions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-3 font-semibold text-slate-900">Not included</h2>
              <ul className="space-y-2">
                {booking.package.exclusions.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-sm text-slate-700">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {e.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Help */}
      <div className="mt-6 rounded-2xl bg-slate-900 p-6 text-center text-white">
        <h2 className="font-display text-xl font-semibold">Need help with this trip?</h2>
        <p className="mt-1 text-sm text-slate-300">Our team is here before, during and after your travel.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {settings.phone && (
            <a href={`tel:${settings.phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900">
              <Phone className="h-4 w-4" /> {settings.phone}
            </a>
          )}
          {settings.whatsapp && (
            <a
              href={buildWhatsAppLink(settings.whatsapp, `Hi, I need help with booking ${booking.bookingNumber}.`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
