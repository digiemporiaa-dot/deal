import Link from "next/link";
import { Home, Compass, MapPin, Phone, Search } from "lucide-react";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  // Give the visitor somewhere to go instead of a dead end.
  let destinations: { id: string; name: string; slug: string }[] = [];
  try {
    destinations = await prisma.destination.findMany({
      where: { isPublished: true },
      select: { id: true, name: true, slug: true },
      take: 6,
      orderBy: { name: "asc" },
    });
  } catch {
    destinations = [];
  }

  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <div className="relative">
        <p className="font-display text-[110px] font-bold leading-none text-brand-100 sm:text-[150px]">404</p>
        <Compass className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-brand-500" />
      </div>

      <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">
        Looks like this page took a holiday
      </h1>
      <p className="mt-3 max-w-lg text-slate-600">
        The page you were looking for doesn&rsquo;t exist or has moved. But your next trip is still
        right here — start with one of these.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Home className="h-4 w-4" /> Home
        </Link>
        <Link
          href="/packages"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Search className="h-4 w-4" /> Browse packages
        </Link>
        <Link
          href="/contact"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Phone className="h-4 w-4" /> Talk to us
        </Link>
      </div>

      {destinations.length > 0 && (
        <div className="mt-12 w-full max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Popular destinations
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {destinations.map((d) => (
              <Link
                key={d.id}
                href={`/destinations/${d.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                <MapPin className="h-3.5 w-3.5" /> {d.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
