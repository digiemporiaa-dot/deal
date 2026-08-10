"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus } from "@/app/admin/(panel)/bookings/actions";

const STATUSES = ["PENDING", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED"];

export function BookingStatusSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <select
      value={value}
      disabled={pending}
      onChange={async (e) => {
        setPending(true);
        await updateBookingStatus(id, e.target.value);
        router.refresh();
        setPending(false);
      }}
      className="h-9 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500 focus:outline-none"
    >
      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
    </select>
  );
}
