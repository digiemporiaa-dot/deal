"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, TicketCheck, AlertTriangle } from "lucide-react";
import { customerLogin } from "@/app/(public)/my-trips/actions";
import { Input, Label } from "@/components/ui/Field";

export function CustomerLogin() {
  const router = useRouter();
  const [bookingNumber, setBookingNumber] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await customerLogin(bookingNumber, contact);
    if (res.ok) router.refresh();
    else {
      setError(res.error);
      setPending(false);
    }
  };

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <TicketCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-slate-900">My Trips</h1>
          <p className="mt-2 text-slate-600">
            View your booking, itinerary, payments and documents in one place.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <Label>Booking number</Label>
              <Input
                value={bookingNumber}
                onChange={(e) => setBookingNumber(e.target.value)}
                placeholder="e.g. VD-2026-0042"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-500">
                It&rsquo;s on your booking confirmation email or message.
              </p>
            </div>

            <div>
              <Label>Phone number or email</Label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="98765 43210 or you@email.com"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-500">The one you used while booking.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || !bookingNumber.trim() || !contact.trim()}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {pending ? "Checking…" : "View my trips"}
          </button>

          {error && (
            <p className="mt-3 inline-flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            No password needed. Can&rsquo;t find your booking number? Contact us and we&rsquo;ll help.
          </p>
        </form>
      </div>
    </div>
  );
}
