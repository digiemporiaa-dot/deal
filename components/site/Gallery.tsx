import Image from "next/image";

type Img = { id: string; url: string; alt: string | null };

export function Gallery({ images, title }: { images: Img[]; title: string }) {
  if (images.length === 0) return null;
  const [hero, ...rest] = images;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:grid-rows-2">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100 md:col-span-2 md:row-span-2 md:aspect-auto">
        <Image src={hero.url} alt={hero.alt || title} fill priority sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
      </div>
      {rest.slice(0, 4).map((img) => (
        <div key={img.id} className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
          <Image src={img.url} alt={img.alt || title} fill sizes="25vw" className="object-cover" />
        </div>
      ))}
    </div>
  );
}
