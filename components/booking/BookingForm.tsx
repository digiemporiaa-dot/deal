"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Tag } from "lucide-react";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

type Pkg = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  startingPrice: number;
  discountPrice: number | null;
  minTravellers: number;
  maxTravellers: number;
  coverImage: string | null;
};

type Breakdown = {
  currency: string;
  baseAmount: number;
  packageDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  advancePercent: number;
  advanceAmount: number;
  remainingAmount: number;
  couponError?: string;
};

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = RAZORPAY_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BookingForm({ pkg }: { pkg: Pkg }) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    travelDate: "",
    adults: 2,
    children: 0,
    rooms: 1,
    couponCode: "",
    specialRequests: "",
    name: "",
    email: "",
    phone: "",
    whatsapp: "",
    country: "India",
    city: "",
  });
  const [breakdown, setBreakdown] = React.useState<Breakdown | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Live server-side price whenever travellers/coupon change.
  const fetchQuote = React.useCallback(
    async (couponOverride?: string) => {
      setQuoting(true);
      try {
        const res = await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: pkg.id,
            adults: form.adults,
            children: form.children,
            couponCode: couponOverride ?? form.couponCode,
          }),
        });
        const data = await res.json();
        if (data.ok) setBreakdown(data.price);
      } finally {
        setQuoting(false);
      }
    },
    [pkg.id, form.adults, form.children, form.couponCode],
  );

  React.useEffect(() => {
    fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.adults, form.children]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload = {
        packageId: pkg.id,
        travelDate: form.travelDate,
        adults: form.adults,
        children: form.children,
        rooms: form.rooms,
        couponCode: form.couponCode,
        specialRequests: form.specialRequests,
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          whatsapp: form.whatsapp,
          country: form.country,
          city: form.city,
        },
      };
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not create booking.");
        if (data.issues) setFieldErrors(data.issues);
        setSubmitting(false);
        return;
      }

      if (data.payment === "razorpay") {
        const loaded = await loadRazorpay();
        if (!loaded || !window.Razorpay) {
          setError("Could not load the payment gateway. Please try again.");
          setSubmitting(false);
          return;
        }
        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.order.amount,
          currency: data.order.currency,
          name: "Vacationdeal",
          description: pkg.name,
          order_id: data.order.id,
          prefill: { name: form.name, email: form.email, contact: form.phone },
          theme: { color: "#1b70f1" },
          handler: async (response) => {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.ok) {
              router.push(`/booking/${verifyData.bookingNumber}?status=success`);
            } else {
              router.push(`/booking/${data.bookingNumber}?status=failed`);
            }
          },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
              setError("Payment was cancelled. Your booking is saved — you can retry payment anytime.");
            },
          },
        });
        rzp.open();
      } else {
        // Manual follow-up (gateway not configured).
        router.push(`/booking/${data.bookingNumber}?status=received`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Left: form */}
      <div className="space-y-8 lg:col-span-2">
        <fieldset className="rounded-2xl border border-slate-200 p-6">
          <legend className="px-2 text-sm font-semibold text-slate-900">Trip details</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="travelDate">Travel date *</Label>
              <Input id="travelDate" type="date" value={form.travelDate} onChange={(e) => set("travelDate", e.target.value)} required />
              <FieldError message={fieldErrors.travelDate?.[0]} />
            </div>
            <div>
              <Label htmlFor="rooms">Rooms</Label>
              <Input id="rooms" type="number" min={1} value={form.rooms} onChange={(e) => set("rooms", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="adults">Adults *</Label>
              <Input id="adults" type="number" min={1} value={form.adults} onChange={(e) => set("adults", Number(e.target.value))} required />
            </div>
            <div>
              <Label htmlFor="children">Children</Label>
              <Input id="children" type="number" min={0} value={form.children} onChange={(e) => set("children", Number(e.target.value))} />
              <p className="mt-1 text-xs text-slate-400">Children are billed at 50%.</p>
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-2xl border border-slate-200 p-6">
          <legend className="px-2 text-sm font-semibold text-slate-900">Your details</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Full name *</Label>
              <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <FieldError message={fieldErrors["customer.name"]?.[0]} />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              <FieldError message={fieldErrors["customer.email"]?.[0]} />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
              <FieldError message={fieldErrors["customer.phone"]?.[0]} />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="specialRequests">Special requests</Label>
              <Textarea id="specialRequests" value={form.specialRequests} onChange={(e) => set("specialRequests", e.target.value)} placeholder="Dietary needs, room preferences, etc." />
            </div>
          </div>
        </fieldset>
      </div>

      {/* Right: summary */}
      <aside className="lg:col-span-1">
        <div className="sticky top-24 rounded-2xl border border-slate-200 p-6">
          {pkg.coverImage && (
            <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-slate-100">
              <Image src={pkg.coverImage} alt={pkg.name} fill sizes="33vw" className="object-cover" />
            </div>
          )}
          <h3 className="font-semibold text-slate-900">{pkg.name}</h3>

          {/* Coupon */}
          <div className="mt-4">
            <Label htmlFor="coupon">Coupon code</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="coupon"
                  className="pl-9 uppercase"
                  value={form.couponCode}
                  onChange={(e) => set("couponCode", e.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                />
              </div>
              <Button type="button" variant="outline" onClick={() => fetchQuote()}>
                Apply
              </Button>
            </div>
            {breakdown?.couponError && <p className="mt-1 text-xs text-red-600">{breakdown.couponError}</p>}
            {breakdown?.couponCode && <p className="mt-1 text-xs text-emerald-600">Coupon {breakdown.couponCode} applied.</p>}
          </div>

          {/* Price breakdown */}
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
            {quoting && (
              <p className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Updating price…</p>
            )}
            {breakdown && (
              <>
                <Row label="Base amount" value={formatCurrency(breakdown.baseAmount, breakdown.currency)} />
                {breakdown.packageDiscount > 0 && (
                  <Row label="Package discount" value={`− ${formatCurrency(breakdown.packageDiscount, breakdown.currency)}`} muted />
                )}
                {breakdown.couponDiscount > 0 && (
                  <Row label="Coupon discount" value={`− ${formatCurrency(breakdown.couponDiscount, breakdown.currency)}`} muted />
                )}
                <Row label={`Tax (${breakdown.taxPercent}%)`} value={formatCurrency(breakdown.taxAmount, breakdown.currency)} />
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(breakdown.totalAmount, breakdown.currency)}</span>
                </div>
                <div className="mt-2 rounded-lg bg-brand-50 p-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-brand-800">
                    <span>Pay now ({breakdown.advancePercent}% advance)</span>
                    <span>{formatCurrency(breakdown.advanceAmount, breakdown.currency)}</span>
                  </div>
                  <p className="mt-1 text-xs text-brand-700">
                    Balance {formatCurrency(breakdown.remainingAmount, breakdown.currency)} due before travel.
                  </p>
                </div>
              </>
            )}
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting || quoting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
            ) : (
              "Confirm & Pay Advance"
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Secure payment via Razorpay. You will not be charged the full amount now.
          </p>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={muted ? "text-emerald-600" : "text-slate-800"}>{value}</span>
    </div>
  );
}
