import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared form controls, used by the public booking/enquiry forms and by the
 * admin panel.
 *
 * `inputSize` exists because the two need different densities: the public
 * forms want a comfortable 44px target, the admin panel wants compact rows
 * that fit a filter bar. The default is the roomy one, so nothing on the
 * public site changes when an admin screen opts into `sm`.
 */

const inputBase =
  "w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50 disabled:text-slate-500";

const sizes = {
  md: "px-3.5 py-2.5 text-sm",
  sm: "h-9 px-3 py-1.5 text-[13px]",
};

export type InputSize = keyof typeof sizes;

export function controlClasses(size: InputSize = "md", className?: string): string {
  return cn(inputBase, sizes[size], className);
}

type WithSize<T> = T & { inputSize?: InputSize };

export const Input = React.forwardRef<
  HTMLInputElement,
  WithSize<React.InputHTMLAttributes<HTMLInputElement>>
>(function Input({ className, inputSize, ...props }, ref) {
  return <input ref={ref} className={controlClasses(inputSize, className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  WithSize<React.TextareaHTMLAttributes<HTMLTextAreaElement>>
>(function Textarea({ className, inputSize, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={controlClasses(inputSize === "sm" ? "md" : inputSize, cn("min-h-[96px]", className))}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  WithSize<React.SelectHTMLAttributes<HTMLSelectElement>>
>(function Select({ className, inputSize, ...props }, ref) {
  return <select ref={ref} className={controlClasses(inputSize, cn("pr-8", className))} {...props} />;
});

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-slate-700", className)} {...props}>
      {children}
    </label>
  );
}

/** Compact label for admin filter bars, where the control is `inputSize="sm"`. */
export function FilterLabel({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-[11px] font-medium text-admin-text-muted", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}
