import Image from "next/image";
import Link from "next/link";

type DestinationCardData = {
  slug: string;
  name: string;
  country: string;
  shortDescription: string;
  coverImage: string | null;
  _count?: { packages: number };
};

export function DestinationCard({ destination }: { destination: DestinationCardData }) {
  return (
    <Link
      href={`/destinations/${destination.slug}`}
      className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-slate-200"
    >
      {destination.coverImage && (
        <Image
          src={destination.coverImage}
          alt={destination.name}
          fill
          sizes="(max-width:768px) 100vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-white/80">{destination.country}</p>
        <h3 className="mt-1 font-display text-xl font-semibold">{destination.name}</h3>
        {destination._count && (
          <p className="mt-1 text-sm text-white/85">{destination._count.packages} packages</p>
        )}
      </div>
    </Link>
  );
}
