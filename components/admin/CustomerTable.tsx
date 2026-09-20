"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
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
import { CustomerDrawer } from "@/components/admin/CustomerDrawer";
import { useRowDrawer } from "@/components/admin/RowDrawerTable";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { BadgeTone } from "@/components/admin/ui";

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  bookings: number;
  totalSpend: number;
  currency: string;
  lastTripAt: string | null;
  createdAt: string;
  status: "active" | "upcoming" | "past" | "enquiry";
};

const STATUS_META: Record<CustomerRow["status"], { label: string; tone: BadgeTone }> = {
  upcoming: { label: "Travelling soon", tone: "brand" },
  active: { label: "Repeat traveller", tone: "green" },
  past: { label: "Past traveller", tone: "slate" },
  enquiry: { label: "No bookings", tone: "amber" },
};

export function CustomerTable({ customers, filtered }: { customers: CustomerRow[]; filtered: boolean }) {
  const { openId, setOpenId } = useRowDrawer("customer");

  if (customers.length === 0) {
    return (
      <EmptyState
        bordered={false}
        icon={<Users className="h-5 w-5" />}
        title={filtered ? "No customers match that search" : "No customers yet"}
        description={
          filtered
            ? "Try a different name, email or phone number."
            : "A customer record is created the first time someone books. Enquiries live under Leads until then."
        }
        action={
          filtered ? (
            <Link href="/admin/customers" className={buttonClasses("outline", "sm")}>
              Clear search
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <TableWrap minWidth={880}>
        <Thead>
          <tr>
            <Th>Customer</Th>
            <Th>Contact</Th>
            <Th>Location</Th>
            <Th align="right">Trips</Th>
            <Th align="right">Total spend</Th>
            <Th>Last / next trip</Th>
            <Th>Status</Th>
          </tr>
        </Thead>
        <Tbody>
          {customers.map((customer) => {
            const meta = STATUS_META[customer.status];
            return (
              <tr
                key={customer.id}
                onClick={() => setOpenId(customer.id)}
                className={cn(
                  "cursor-pointer transition-colors",
                  openId === customer.id ? "bg-brand-50" : "hover:bg-admin-bg",
                )}
              >
                <Td>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={customer.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-admin-text">
                        {customer.name}
                      </span>
                      <span className="block text-[11px] text-admin-text-subtle">
                        Since {formatDate(customer.createdAt)}
                      </span>
                    </span>
                  </span>
                </Td>

                <Td>
                  <span className="block max-w-[180px] truncate text-[12px]">{customer.email}</span>
                  <span className="block text-[11px] text-admin-text-subtle">{customer.phone}</span>
                </Td>

                <Td className="text-[12px]">{customer.location || "—"}</Td>

                <Td align="right" className="tabular-nums">
                  {customer.bookings}
                </Td>

                <Td align="right" className="font-semibold tabular-nums text-admin-text">
                  {formatCurrency(customer.totalSpend, customer.currency)}
                </Td>

                <Td className="whitespace-nowrap text-[12px]">
                  {customer.lastTripAt ? formatDate(customer.lastTripAt) : "—"}
                </Td>

                <Td>
                  <StatusBadge tone={meta.tone} dot>
                    {meta.label}
                  </StatusBadge>
                </Td>
              </tr>
            );
          })}
        </Tbody>
      </TableWrap>

      <CustomerDrawer customerId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
