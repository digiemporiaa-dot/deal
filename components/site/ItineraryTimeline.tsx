import { Utensils, BedDouble, Activity } from "lucide-react";

type Day = {
  id: string;
  dayNumber: number;
  title: string;
  description: string;
  activities: string | null;
  meals: string | null;
  hotel: string | null;
};

export function ItineraryTimeline({ days }: { days: Day[] }) {
  if (days.length === 0) return null;
  return (
    <ol className="relative border-l-2 border-brand-100 pl-6">
      {days.map((day) => (
        <li key={day.id} className="relative pb-8 last:pb-0">
          <span className="absolute -left-[33px] grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white ring-4 ring-white">
            {day.dayNumber}
          </span>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Day {day.dayNumber}
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-slate-900">{day.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{day.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
              {day.activities && (
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-brand-500" /> {day.activities}
                </span>
              )}
              {day.meals && (
                <span className="inline-flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5 text-brand-500" /> {day.meals}
                </span>
              )}
              {day.hotel && (
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5 text-brand-500" /> {day.hotel}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
