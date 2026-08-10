import Link from "next/link";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel,
  center,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", center && "flex-col text-center")}>
      <div className={cn(center && "mx-auto max-w-2xl")}>
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>}
        <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h2>
        {subtitle && <p className="mt-3 text-slate-600">{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="text-sm font-semibold text-brand-600 hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
