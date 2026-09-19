import { cn } from "@/lib/utils";

/**
 * Dashboard charts.
 *
 * Plain server-rendered SVG — no charting library, no client bundle, and the
 * numbers are in the HTML so they are readable without JavaScript. Each chart
 * renders an empty state rather than an empty axis when there is no data.
 */

const PALETTE = {
  brand: "#0d9488",
  brandSoft: "#99f6e4",
  amber: "#f59e0b",
  slate: "#94a3b8",
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
      {message}
    </div>
  );
}

export type SeriesPoint = { label: string; value: number };

/**
 * Line chart with an area fill. Values are normalised to the tallest point, so
 * the shape is always readable whatever the scale.
 */
export function LineChart({
  points,
  height = 180,
  color = PALETTE.brand,
  valueFormatter,
  emptyMessage = "No data for this period",
}: {
  points: SeriesPoint[];
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}) {
  if (points.length === 0) return <EmptyChart message={emptyMessage} />;

  const width = 600;
  const padding = { top: 10, right: 8, bottom: 22, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => ({
    x: padding.left + index * step,
    y: padding.top + innerHeight - (point.value / max) * innerHeight,
    ...point,
  }));

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)} L${coords[0]!.x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)} Z`;

  // Only a handful of labels, so they never overlap on a narrow screen.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Trend chart with ${points.length} points, highest value ${valueFormatter ? valueFormatter(max) : max}`}
      >
        <path d={area} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r={2.5} fill={color}>
            <title>{`${c.label}: ${valueFormatter ? valueFormatter(c.value) : c.value}`}</title>
          </circle>
        ))}
        {coords.map((c, index) =>
          index % labelEvery === 0 ? (
            <text
              key={`label-${c.label}`}
              x={c.x}
              y={height - 6}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 10 }}
            >
              {c.label}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

/** Horizontal bars — better than a pie for comparing named categories. */
export function BarList({
  rows,
  valueFormatter,
  color = PALETTE.brand,
  emptyMessage = "Nothing to show yet",
}: {
  rows: { label: string; value: number; secondary?: string }[];
  valueFormatter?: (value: number) => string;
  color?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) return <EmptyChart message={emptyMessage} />;

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-700">{row.label}</span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {valueFormatter ? valueFormatter(row.value) : row.value}
              {row.secondary && <span className="ml-2 text-xs text-slate-400">{row.secondary}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Conversion funnel. Each stage is drawn relative to the first, and the
 * drop-off from the previous stage is shown as a percentage.
 */
export function Funnel({
  stages,
  emptyMessage = "No enquiries in this period",
}: {
  stages: { stage: string; count: number }[];
  emptyMessage?: string;
}) {
  const top = stages[0]?.count ?? 0;
  if (top === 0) return <EmptyChart message={emptyMessage} />;

  return (
    <ol className="space-y-2">
      {stages.map((stage, index) => {
        const width = Math.max(4, (stage.count / top) * 100);
        const previous = index > 0 ? stages[index - 1]!.count : null;
        // Guarded against division by zero — a stage after an empty one shows
        // no percentage rather than NaN.
        const retention = previous && previous > 0 ? Math.round((stage.count / previous) * 100) : null;

        return (
          <li key={stage.stage}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{stage.stage}</span>
              <span className="tabular-nums text-slate-900">
                {stage.count}
                {retention !== null && index > 0 && (
                  <span
                    className={cn(
                      "ml-2 text-xs",
                      retention >= 50 ? "text-emerald-600" : retention >= 25 ? "text-amber-600" : "text-red-600",
                    )}
                  >
                    {retention}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
              <div
                className="flex h-full items-center rounded-lg px-2 text-xs font-medium text-white"
                style={{
                  width: `${width}%`,
                  backgroundColor: index === stages.length - 1 ? PALETTE.brand : PALETTE.slate,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
