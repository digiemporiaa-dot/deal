import Image from "next/image";
import { Star } from "lucide-react";

type T = {
  id: string;
  customerName: string;
  rating: number;
  review: string;
  destination: string | null;
  image: string | null;
};

export function Testimonials({ items }: { items: T[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => (
        <figure key={t.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={i < t.rating ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-slate-300"}
              />
            ))}
          </div>
          <blockquote className="mt-4 flex-1 text-slate-700">&ldquo;{t.review}&rdquo;</blockquote>
          <figcaption className="mt-5 flex items-center gap-3">
            {t.image && (
              <Image src={t.image} alt={t.customerName} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{t.customerName}</p>
              {t.destination && <p className="text-xs text-slate-500">{t.destination}</p>}
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
