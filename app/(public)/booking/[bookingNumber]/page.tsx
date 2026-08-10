import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getBookingByNumber } from "@/lib/services/booking";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Booking status", robots: { index: false } };

type Props = {
  params: Promise<{ bookingNumber: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function BookingStatusPage({ params, searchParams }: Props) {
  const { bookingNumber } = await params;
  const { status } = await searchParams;
  const booking = await getBookingByNumber(bookingNumber);
  if (!booking) notFound();

  const isSuccess = status === "success" || booking.paymentStatus === "PAID";
  const isFailed = status === "failed";

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 p-8 text-center">
        {isSuccess ? (
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        ) : isFailed ? (
          <XCircle className="mx-auto h-16 w-16 text-red-500" />
        ) : (
          <Clock className="mx-auto h-16 w-16 text-amber-500" />
        )}

        <h1 className="mt-5 font-display text-2xl font-bold text-slate-900">
          {isSuccess ? "Booking confirmed!" : isFailed ? "Payment not completed" : "Booking received"}
        </h1>
        <p className="mt-2 text-slate-600">
          {isSuccess
            ? "Thank you! A confirmation has been emailed to you. Our team will be in touch shortly."
            : isFailed
              ? "Your payment could not be verified. No amount has been charged. You can retry payment anytime."
              : "We have received your booking request. Our travel expert will contact you to finalise payment and itinerary."}
        </p>

        <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-5 text-left text-sm">
          <Row label="Booking number" value={booking.bookingNumber} />
          <Row label="Package" value={booking.package.name} />
          <Row label="Travel date" value={formatDate(booking.travelDate)} />
          <Row label="Travellers" value={`${booking.adults} adults, ${booking.children} children`} />
          <Row label="Total amount" value={formatCurrency(toNumber(booking.totalAmount), booking.currency)} />
          <Row label="Advance" value={formatCurrency(toNumber(booking.advanceAmount), booking.currency)} />
          <Row label="Payment status" value={booking.paymentStatus} />
        </dl>

        <div className="mt-6 flex justify-center gap-3">
          <LinkButton href="/packages" variant="outline">Browse more trips</LinkButton>
          {isFailed && (
            <LinkButton href={`/packages/${booking.package.slug}/book`}>Retry payment</LinkButton>
          )}
          {isSuccess && <LinkButton href="/">Back home</LinkButton>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
