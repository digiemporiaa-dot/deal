"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Package as PackageIcon,
  Phone,
  Users,
} from "lucide-react";
import { Drawer } from "@/components/admin/overlay";
import {
  Avatar,
  DetailRow,
  StatusBadge,
  TableWrap,
  Thead,
  Tbody,
  Th,
  Td,
  buttonClasses,
} from "@/components/admin/ui";
import { Tabs } from "@/components/admin/Tabs";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/admin/Toast";
import { updateBookingStatus } from "@/app/admin/(panel)/bookings/actions";
import { bookingStatusTone, paymentStatusTone, humanStatus } from "@/lib/admin-status";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { BookingDetail } from "@/app/api/admin/bookings/[id]/route";

/**
 * Booking preview drawer.
 *
 * A booking is money and a departure date, so the drawer leads with both and
 * keeps the payment trail one tab away. Status is the one thing changeable
 * from here — it is the change an operations lead makes constantly — and it
 * goes through the existing Server Action, which owns the permission check
 * and the audit entry.
 */

const STATUSES = [
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

export function BookingDrawer({
  bookingId,
  onClose,
}: {
  bookingId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [booking, setBooking] = React.useState<BookingDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (id: string, background = false) => {
    if (!background) {
      setLoading(true);
      setBooking(null);
    }
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${id}`);
      if (response.status === 404) {
        setError("This booking is no longer available.");
        return;
      }
      if (!response.ok) throw new Error("failed");
      setBooking((await response.json()) as BookingDetail);
    } catch {
      setError("Could not load this booking.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (bookingId) void load(bookingId);
  }, [bookingId, load]);

  const changeStatus = async (status: string) => {
    if (!booking) return;
    setBusy(true);
    try {
      const result = (await updateBookingStatus(booking.id, status)) as
        | { ok?: boolean; error?: string }
        | undefined;
      if (result && result.ok === false) {
        toast.error(result.error ?? "Could not change the status.");
        return;
      }
      toast.success("Booking updated.");
      await load(booking.id, true);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const money = (amount: number) => formatCurrency(amount, booking?.currency ?? "INR");

  return (
    <Drawer
      open={bookingId !== null}
      onClose={onClose}
      width="lg"
      busy={busy}
      title={booking?.bookingNumber ?? "Booking"}
      header={
        booking && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold leading-tight text-admin-text">
                {booking.bookingNumber}
              </h2>
              <StatusBadge tone={bookingStatusTone(booking.status)} dot>
                {humanStatus(booking.status)}
              </StatusBadge>
              <StatusBadge tone={paymentStatusTone(booking.paymentStatus)}>
                {humanStatus(booking.paymentStatus)}
              </StatusBadge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-admin-text-muted">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Departs {formatDate(booking.travelDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {booking.adults} adult{booking.adults === 1 ? "" : "s"}
                {booking.children > 0 && `, ${booking.children} child${booking.children === 1 ? "" : "ren"}`}
              </span>
            </p>
          </div>
        )
      }
      footer={
        booking && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              <span className="text-admin-text-muted">Total</span>{" "}
              <span className="font-display text-base font-bold text-admin-text">
                {money(booking.totalAmount)}
              </span>
              {booking.remainingAmount > 0 && (
                <span className="ml-2 text-xs font-medium text-admin-warning">
                  {money(booking.remainingAmount)} outstanding
                </span>
              )}
            </span>
            <Link href={`/admin/bookings?booking=${booking.id}`} className={buttonClasses("ghost", "sm")}>
              Permalink
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )
      }
    >
      {loading && <DrawerSkeleton />}

      {error && !loading && (
        <div className="p-5">
          <div className="rounded-card border border-red-200 bg-red-50 p-5 text-center">
            <p className="text-sm font-medium text-red-900">{error}</p>
            <button
              type="button"
              onClick={() => bookingId && void load(bookingId)}
              className={cn(buttonClasses("outline", "sm"), "mt-3")}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {booking && !loading && (
        <div className="p-5">
          {booking.can.update && (
            <label className="mb-5 block">
              <span className="mb-1 block text-[11px] font-medium text-admin-text-muted">
                Booking status
              </span>
              <Select
                inputSize="sm"
                value={booking.status}
                disabled={busy}
                onChange={(event) => void changeStatus(event.target.value)}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {humanStatus(status)}
                  </option>
                ))}
              </Select>
            </label>
          )}

          <Tabs
            items={[
              {
                id: "summary",
                label: "Summary",
                content: <Summary booking={booking} money={money} />,
              },
              {
                id: "payments",
                label: "Payments",
                badge:
                  booking.payments.length > 0 ? (
                    <span className="rounded-full bg-admin-muted px-1.5 text-[10px] tabular-nums text-admin-text-muted">
                      {booking.payments.length}
                    </span>
                  ) : undefined,
                content: <Payments booking={booking} money={money} />,
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  );
}

function Summary({
  booking,
  money,
}: {
  booking: BookingDetail;
  money: (amount: number) => string;
}) {
  return (
    <div className="space-y-5">
      {/* Customer */}
      <div className="rounded-card border border-admin bg-admin-bg p-3.5">
        <div className="flex items-start gap-2.5">
          <Avatar name={booking.customer.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-admin-text">
              {booking.customer.name}
            </p>
            {booking.customer.location && (
              <p className="truncate text-[11px] text-admin-text-muted">{booking.customer.location}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <a
                href={`tel:${booking.customer.phone}`}
                className="admin-focus inline-flex h-7 items-center gap-1.5 rounded-control border border-admin bg-admin-card px-2 text-[11px] font-semibold text-admin-text-muted hover:border-brand-300 hover:text-brand-700"
              >
                <Phone className="h-3 w-3" />
                {booking.customer.phone}
              </a>
              <a
                href={`mailto:${booking.customer.email}`}
                className="admin-focus inline-flex h-7 max-w-full items-center gap-1.5 rounded-control border border-admin bg-admin-card px-2 text-[11px] font-semibold text-admin-text-muted hover:border-brand-300 hover:text-brand-700"
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{booking.customer.email}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Trip */}
      <div>
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
          <PackageIcon className="h-3.5 w-3.5" />
          Trip
        </h3>
        <dl className="divide-y divide-admin-border">
          <DetailRow label="Package">
            <Link href={`/admin/packages/${booking.package.id}/edit`} className="hover:text-brand-700">
              {booking.package.name}
            </Link>
          </DetailRow>
          <DetailRow label="Destination">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-admin-text-subtle" />
              {booking.package.destination}
            </span>
          </DetailRow>
          <DetailRow label="Duration">
            {booking.package.durationDays} days / {booking.package.durationNights} nights
          </DetailRow>
          <DetailRow label="Travel date">{formatDate(booking.travelDate)}</DetailRow>
          <DetailRow label="Rooms">{booking.rooms}</DetailRow>
          <DetailRow label="Booked on">{formatDate(booking.createdAt)}</DetailRow>
        </dl>
      </div>

      {/* Money */}
      <div>
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
          <CreditCard className="h-3.5 w-3.5" />
          Amount
        </h3>
        <dl className="divide-y divide-admin-border">
          <DetailRow label="Base">{money(booking.baseAmount)}</DetailRow>
          {booking.discountAmount > 0 && (
            <DetailRow label={`Discount${booking.couponCode ? ` (${booking.couponCode})` : ""}`}>
              <span className="text-admin-success">−{money(booking.discountAmount)}</span>
            </DetailRow>
          )}
          {booking.taxAmount > 0 && <DetailRow label="Tax">{money(booking.taxAmount)}</DetailRow>}
          <DetailRow label="Total" className="font-semibold">
            {money(booking.totalAmount)}
          </DetailRow>
          <DetailRow label="Advance paid">{money(booking.advanceAmount)}</DetailRow>
          <DetailRow label="Outstanding">
            <span className={booking.remainingAmount > 0 ? "text-admin-warning" : undefined}>
              {money(booking.remainingAmount)}
            </span>
          </DetailRow>
        </dl>
      </div>

      {booking.specialRequests && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
            Special requests
          </h3>
          <p className="whitespace-pre-line rounded-card border border-admin bg-admin-bg p-3.5 text-[13px] leading-relaxed text-admin-text">
            {booking.specialRequests}
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
          Attribution
        </h3>
        <dl className="divide-y divide-admin-border">
          <DetailRow label="Source">{humanStatus(booking.source)}</DetailRow>
          <DetailRow label="Campaign">{booking.campaign || "—"}</DetailRow>
        </dl>
      </div>
    </div>
  );
}

function Payments({
  booking,
  money,
}: {
  booking: BookingDetail;
  money: (amount: number) => string;
}) {
  if (booking.payments.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-admin p-8 text-center text-sm text-admin-text-subtle">
        No payment has been attempted against this booking yet.
      </p>
    );
  }

  return (
    <TableWrap minWidth={420}>
      <Thead>
        <tr>
          <Th>Reference</Th>
          <Th>Method</Th>
          <Th align="right">Amount</Th>
          <Th>Status</Th>
        </tr>
      </Thead>
      <Tbody>
        {booking.payments.map((payment) => (
          <tr key={payment.id}>
            <Td>
              <span className="block max-w-[150px] truncate font-mono text-[11px] text-admin-text">
                {payment.reference ?? "—"}
              </span>
              <span className="block text-[11px] text-admin-text-subtle">
                {formatDate(payment.createdAt)}
              </span>
            </Td>
            <Td className="text-[12px]">{payment.method ? humanStatus(payment.method) : "—"}</Td>
            <Td align="right" className="font-semibold tabular-nums text-admin-text">
              {money(payment.amount)}
            </Td>
            <Td>
              <StatusBadge tone={paymentStatusTone(payment.status)} dot>
                {humanStatus(payment.status)}
              </StatusBadge>
            </Td>
          </tr>
        ))}
      </Tbody>
    </TableWrap>
  );
}

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="h-9 rounded-control bg-admin-muted" />
      <div className="h-20 rounded-card bg-admin-muted" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-7 rounded-control bg-admin-muted" />
        ))}
      </div>
    </div>
  );
}
