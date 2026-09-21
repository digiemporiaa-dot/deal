import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-site-button-text hover:bg-brand-700 focus-visible:ring-brand-500",
  secondary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-500",
  outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-brand-500",
  ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

/**
 * `--site-button-radius` is a variable rather than a fixed `rounded-lg` so the
 * appearance module can reshape every button at once. It defaults to 8px in
 * globals.css — exactly what `rounded-lg` was — and only public pages override
 * it, so the admin panel keeps its own shape.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--site-button-radius)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
