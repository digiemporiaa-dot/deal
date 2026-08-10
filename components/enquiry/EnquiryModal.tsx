"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import { leadSchema, type LeadInput } from "@/lib/validation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Field";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  defaultDestination?: string;
  source?: string;
};

export function EnquiryModal({ isOpen, onClose, title, defaultDestination, source }: Props) {
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: { destination: defaultDestination ?? "", source: source ?? "website" },
  });

  React.useEffect(() => {
    if (isOpen) {
      setStatus("idle");
      setServerError(null);
      reset({ destination: defaultDestination ?? "", source: source ?? "website" });
    }
  }, [isOpen, defaultDestination, source, reset]);

  // Close on Escape, lock body scroll while open.
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const onSubmit = async (values: LeadInput) => {
    setStatus("submitting");
    setServerError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setServerError(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setServerError("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="enquiry-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-in rounded-2xl bg-white shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        {status === "success" ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-500" />
            <h3 className="text-xl font-semibold text-slate-900">Thank you!</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-600">
              Your enquiry has been received. Our travel expert will reach out to you shortly.
            </p>
            <Button className="mt-6" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="max-h-[85vh] overflow-y-auto p-6">
            <h3 id="enquiry-title" className="text-xl font-semibold text-slate-900">
              {title || "Plan My Trip"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Share a few details and we&apos;ll craft the perfect trip for you.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Full name *</Label>
                <Input id="name" {...register("name")} placeholder="Your name" />
                <FieldError message={errors.name?.message} />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" {...register("phone")} placeholder="Mobile number" />
                <FieldError message={errors.phone?.message} />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" {...register("whatsapp")} placeholder="WhatsApp number" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} placeholder="you@email.com" />
                <FieldError message={errors.email?.message} />
              </div>
              <div>
                <Label htmlFor="destination">Destination</Label>
                <Input id="destination" {...register("destination")} placeholder="e.g. Bali" />
              </div>
              <div>
                <Label htmlFor="travelDate">Travel date</Label>
                <Input id="travelDate" type="date" {...register("travelDate")} />
              </div>
              <div>
                <Label htmlFor="travellers">Travellers</Label>
                <Input id="travellers" type="number" min={1} {...register("travellers")} placeholder="2" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="budget">Budget</Label>
                <Input id="budget" {...register("budget")} placeholder="e.g. ₹1L – ₹2L" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" {...register("message")} placeholder="Tell us about your dream trip..." />
              </div>
            </div>

            {serverError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
            )}

            <Button type="submit" size="lg" className="mt-5 w-full" disabled={status === "submitting"}>
              {status === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                </>
              ) : (
                "Send Enquiry"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
