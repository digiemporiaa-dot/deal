"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Mail, MessageCircle, Phone, Plane } from "lucide-react";
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
import { bookingStatusTone, paymentStatusTone, humanStatus } from "@/lib/admin-status";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { CustomerDetail } from "@/app/api/admin/customers/[id]/route";

/**
 * Customer preview drawer.
 *
 * A travel customer is mostly their trip history, so that is what this leads
 * with — lifetime value, how many trips, and whether one is coming up. The
 * booking rows link into the bookings list rather than duplicating a booking
 * view here.
 */
export function CustomerDrawer({
  customerId,
  onClose,
}: {
  customerId: string | null;
  onClose: () => void;
}) {
  const [customer, setCustomer] = React.useState<CustomerDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (id: string) => {
    setLoading(true);
    setCustomer(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/customers/${id}`);
      if (response.status === 404) {
        setError("This customer is no longer available.");
        return;
      }
      if (!response.ok) throw new Error("failed");
      setCustomer((await response.json()) as CustomerDetail);
    } catch {
      setError("Could not load this customer.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (customerId) void load(customerId);
  }, [customerId, load]);

  const money = (amount: number) => formatCurrency(amount, customer?.totals.currency ?? "INR");

  const upcoming = customer?.bookings.find(
    (booking) =>
      new Date(booking.travelDate) >= new Date() &&
      booking.status !== "CANCELLED" &&
      booking.status !== "COMPLETED",
  );

  return (
    <Drawer
      open={customerId !== null}
      onClose={onClose}
      width="lg"
      title={customer?.name ?? "Customer"}
      header={
        customer && (
          <div className="flex items-start gap-3">
            <Avatar name={customer.name} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-lg font-bold leading-tight text-admin-text">
                {customer.name}
              </h2>
              {customer.location && (
                <p className="truncate text-xs text-admin-text-muted">{customer.location}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Action href={`tel:${customer.phone}`} icon={<Phone className="h-3 w-3" />} label="Call" />
                <Action
                  href={`mailto:${customer.email}`}
                  icon={<Mail className="h-3 w-3" />}
                  label="Email"
                />
                <Action
                  href={buildWhatsAppLink(
                    customer.whatsapp || customer.phone,
                    `Hi ${customer.name}, about your trip`,
                  )}
                  icon={<MessageCircle className="h-3 w-3" />}
                  label="WhatsApp"
                  external
                />
              </div>
            </div>
          </div>
        )
      }
    >
      {loading && (
        <div className="animate-pulse space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 rounded-card bg-admin-muted" />
            ))}
          </div>
          <div className="h-40 rounded-card bg-admin-muted" />
        </div>
      )}

      {error && !loading && (
        <div className="p-5">
          <div className="rounded-card border border-red-200 bg-red-50 p-5 text-center">
            <p className="text-sm font-medium text-red-900">{error}</p>
            <button
              type="button"
              onClick={() => customerId && void load(customerId)}
              className={cn(buttonClasses("outline", "sm"), "mt-3")}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {customer && !loading && (
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-2.5">
            <Tile label="Trips" value={String(customer.totals.bookings)} />
            <Tile label="Lifetime value" value={money(customer.totals.spend)} />
            <Tile
              label="Cancelled"
              value={String(customer.totals.cancelled)}
              tone={customer.totals.cancelled > 0 ? "warn" : undefined}
            />
          </div>

          {upcoming && (
            <div className="flex items-center gap-2.5 rounded-card border border-brand-200 bg-brand-50 px-3.5 py-2.5">
              <Plane className="h-4 w-4 shrink-0 text-brand-600" />
              <p className="text-[13px] text-brand-900">
                Travelling to <strong>{upcoming.destination}</strong> on{" "}
                <strong>{formatDate(upcoming.travelDate)}</strong>
              </p>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
              Contact
            </h3>
            <dl className="divide-y divide-admin-border">
              <DetailRow label="Email">{customer.email}</DetailRow>
              <DetailRow label="Phone">{customer.phone}</DetailRow>
              <DetailRow label="WhatsApp">{customer.whatsapp || customer.phone}</DetailRow>
              <DetailRow label="Customer since">{formatDate(customer.createdAt)}</DetailRow>
            </dl>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
              <CalendarDays className="h-3.5 w-3.5" />
              Travel history
            </h3>

            {customer.bookings.length === 0 ? (
              <p className="rounded-card border border-dashed border-admin p-6 text-center text-sm text-admin-text-subtle">
                This customer has not booked yet.
              </p>
            ) : (
              <div className="admin-card overflow-hidden">
                <TableWrap minWidth={420}>
                  <Thead>
                    <tr>
                      <Th>Trip</Th>
                      <Th>Date</Th>
                      <Th align="right">Amount</Th>
                      <Th>Status</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {customer.bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-admin-bg">
                        <Td>
                          {customer.can.viewBookings ? (
                            <Link
                              href={`/admin/bookings?booking=${booking.id}`}
                              className="block max-w-[180px] truncate text-[13px] font-medium text-admin-text hover:text-brand-700"
                            >
                              {booking.packageName}
                            </Link>
                          ) : (
                            <span className="block max-w-[180px] truncate text-[13px] font-medium text-admin-text">
                              {booking.packageName}
                            </span>
                          )}
                          <span className="block text-[11px] text-admin-text-subtle">
                            {booking.bookingNumber} · {booking.destination}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-[12px]">
                          {formatDate(booking.travelDate)}
                        </Td>
                        <Td align="right" className="font-semibold tabular-nums text-admin-text">
                          {formatCurrency(booking.totalAmount, booking.currency)}
                        </Td>
                        <Td>
                          <span className="flex flex-col items-start gap-1">
                            <StatusBadge tone={bookingStatusTone(booking.status)} dot>
                              {humanStatus(booking.status)}
                            </StatusBadge>
                            <StatusBadge tone={paymentStatusTone(booking.paymentStatus)}>
                              {humanStatus(booking.paymentStatus)}
                            </StatusBadge>
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </Tbody>
                </TableWrap>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-card border border-admin bg-admin-bg px-3 py-2.5">
      <p className="text-[11px] text-admin-text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-display text-base font-bold",
          tone === "warn" ? "text-admin-warning" : "text-admin-text",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Action({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="admin-focus inline-flex h-7 items-center gap-1.5 rounded-control border border-admin px-2 text-[11px] font-semibold text-admin-text-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      {icon}
      {label}
    </a>
  );
}
