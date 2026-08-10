import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, toNumber } from "@/lib/utils";

type PackageCardData = {
  slug: string;
  name: string;
  durationDays: number;
  durationNights: number;
  startingPrice: unknown;
  discountPrice: unknown;
  currency: string;
  featured: boolean;
  destination: { name: string; country: string };
  category?: { name: string } | null;
  images: { url: string; alt: string | null }[];
};

export function PackageCard({ pkg }: { pkg: PackageCardData }) {
  const price = pkg.discountPrice != null ? toNumber(pkg.discountPrice) : toNumber(pkg.startingPrice);
  const hasDiscount = pkg.discountPrice != null;
  const cover = pkg.images[0]?.url;

  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {cover ? (
          <Image
            src={cover}
            alt={pkg.images[0]?.alt || pkg.name}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        {pkg.featured && (
          <span className="absolute left-3 top-3">
            <Badge tone="brand">
              <Star className="mr-1 h-3 w-3 fill-current" /> Featured
            </Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5" />
          {pkg.destination.name}, {pkg.destination.country}
        </div>
        <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold text-slate-900 group-hover:text-brand-700">
          {pkg.name}
        </h3>
        <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
          <Clock className="h-4 w-4" />
          {pkg.durationDays} Days / {pkg.durationNights} Nights
        </div>
        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-xs text-slate-500">Starting from</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900">{formatCurrency(price, pkg.currency)}</span>
              {hasDiscount && (
                <span className="text-sm text-slate-400 line-through">
                  {formatCurrency(toNumber(pkg.startingPrice), pkg.currency)}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-semibold text-brand-600 group-hover:underline">View →</span>
        </div>
      </div>
    </Link>
  );
}
