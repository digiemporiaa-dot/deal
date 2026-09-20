"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Inbox } from "lucide-react";
import {
  Avatar,
  StatusBadge,
  TableWrap,
  Thead,
  Tbody,
  Th,
  Td,
  EmptyState,
  buttonClasses,
} from "@/components/admin/ui";
import { BookingDrawer } from "@/components/admin/BookingDrawer";
import { useRowDrawer } from "@/components/admin/RowDrawerTable";
import { bookingStatusTone, paymentStatusTone, humanStatus } from "@/lib/admin-status";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export type BookingRow = {
  id: string;
  bookingNumber: string;
  createdAt: string;
  travelDate: string;
  travellers: string;
  totalAmount: number;
  remainingAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  customerName: string;
  customerEmail: string;
  packageName: string;
  destination: string;
};

/** The bookings list. Rows open a preview drawer rather than navigating. */
export function BookingTable({ bookings, filtered }: { bookings: BookingRow[]; filtered: boolean }) {
  const { openId, setOpenId } = useRowDrawer("booking");
  const today = React.useMemo(() => new Date(new Date().toDateString()).getTime(), []);

  if (bookings.length === 0) {
    return (
      <EmptyState
        bordered={false}
        icon={<Inbox className="h-5 w-5" />}
        title={filtered ? "No bookings match these filters" : "No bookings yet"}
        description={
          filtered
            ? "Try widening the date range or clearing a filter."
            : "Bookings made through the website appear here, with their payment status."
        }
        action={
          filtered ? (
            <Link href="/admin/bookings" className={buttonClasses("outline", "sm")}>
              Clear filters
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <TableWrap minWidth={1000}>
        <Thead>
          <tr>
            <Th>Booking</Th>
            <Th>Customer</Th>
            <Th>Package</Th>
            <Th>Travel date</Th>
            <Th align="right">Amount</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
          </tr>
        </Thead>
        <Tbody>
          {bookings.map((booking) => {
            const departsSoon =
              new Date(booking.travelDate).getTime() - today < 7 * 24 * 60 * 60 * 1000 &&
              new Date(booking.travelDate).getTime() >= today &&
              booking.status !== "CANCELLED";

            return (
              <tr
                key={booking.id}
                onClick={() => setOpenId(booking.id)}
                className={cn(
                  "cursor-pointer transition-colors",
                  openId === booking.id ? "bg-brand-50" : "hover:bg-admin-bg",
                )}
              >
                <Td>
                  <span className="block font-mono text-[12px] font-medium text-admin-text">
                    {booking.bookingNumber}
                  </span>
                  <span className="block text-[11px] text-admin-text-subtle">
                    Booked {formatDate(booking.createdAt)}
                  </span>
                </Td>

                <Td>
                  <span className="flex items-center gap-2">
                    <Avatar name={booking.customerName} size="xs" />
                    <span className="min-w-0">
                      <span className="block max-w-[150px] truncate text-[13px] font-medium text-admin-text">
                        {booking.customerName}
                      </span>
                      <span className="block max-w-[150px] truncate text-[11px] text-admin-text-subtle">
                        {booking.customerEmail}
                      </span>
                    </span>
                  </span>
                </Td>

                <Td>
                  <span className="block max-w-[200px] truncate text-[13px] text-admin-text">
                    {booking.packageName}
                  </span>
                  <span className="block text-[11px] text-admin-text-subtle">
                    {booking.destination} · {booking.travellers}
                  </span>
                </Td>

                <Td>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap text-[12px]",
                      departsSoon ? "font-semibold text-brand-700" : "text-admin-text-muted",
                    )}
                  >
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {formatDate(booking.travelDate)}
                  </span>
                </Td>

                <Td align="right">
                  <span className="block font-semibold tabular-nums text-admin-text">
                    {formatCurrency(booking.totalAmount, booking.currency)}
                  </span>
                  {booking.remainingAmount > 0 && (
                    <span className="block text-[11px] tabular-nums text-admin-warning">
                      {formatCurrency(booking.remainingAmount, booking.currency)} due
                    </span>
                  )}
                </Td>

                <Td>
                  <StatusBadge tone={paymentStatusTone(booking.paymentStatus)} dot>
                    {humanStatus(booking.paymentStatus)}
                  </StatusBadge>
                </Td>

                <Td>
                  <StatusBadge tone={bookingStatusTone(booking.status)}>
                    {humanStatus(booking.status)}
                  </StatusBadge>
                </Td>
              </tr>
            );
          })}
        </Tbody>
      </TableWrap>

      <BookingDrawer bookingId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
