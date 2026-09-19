import { cn } from "@/lib/utils";

/**
 * Dashboard charts.
 *
 * Plain server-rendered SVG — no charting library, no client bundle, and the
 * numbers are in the markup so they are readable without JavaScript and by a
 * screen reader. Each chart renders an empty state rather than an empty axis
 * when there is no data.
 *
 * Colour rules, applied throughout:
 *  - Magnitude (how much) is one hue at varying length, never a rainbow.
 *  - Status colour is reserved for states that mean something — confirmed,
 *    cancelled — and never used just to tell two bars apart.
 *  - Every coloured mark sits beside its own text label, so nothing is
 *    identified by colour alone. Amber and red are close enough in most forms
 *    of colour blindness that the label is what actually distinguishes them.
 */

export const CHART_COLORS = {
  /** The single magnitude hue — the brand accent. */
  primary: "#1b70f1",
  /** Secondary series (leads against revenue), distinct in hue and lightness. */
  secondary: "#7c3aed",
  /** Reserved status marks. All four clear 3:1 against a white card. */
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  /** Recessive fills: "everything else" in a share bar. */
  neutral: "#94a3b8",
  neutralSoft: "#cbd5e1",
  grid: "#e2e8f0",
} as const;

function EmptyChart({ message, height = 180 }: { message: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-control border border-dashed border-admin-border text-sm text-admin-text-subtle"
      style={{ height }}
    >
      {message}
    </div>
  );
}

export type SeriesPoint = { label: string; value: number };

/**
 * Line chart with an area fill.
 *
 * One series only, deliberately: two measures on one pair of axes would need
 * two y-scales, and a dual-axis chart lets any two series be made to look
 * correlated. Two measures get two charts.
 */
export function LineChart({
  points,
  height = 200,
  color = CHART_COLORS.primary,
  valueFormatter,
  emptyMessage = "No data for this period",
}: {
  points: SeriesPoint[];
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}) {
  if (points.length === 0) return <EmptyChart message={emptyMessage} height={height} />;

  const format = (value: number) => (valueFormatter ? valueFormatter(value) : String(value));

  const width = 640;
  const padding = { top: 12, right: 10, bottom: 24, left: 10 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => ({
    ...point,
    x: padding.left + index * step,
    y: padding.top + innerHeight - (point.value / max) * innerHeight,
  }));

  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  const baseline = (padding.top + innerHeight).toFixed(1);
  const area = `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${baseline} L${coords[0]!.x.toFixed(1)},${baseline} Z`;

  // Only a handful of x labels, so they never collide on a narrow card.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  // Markers are only readable when they are not touching; past ~40 points the
  // line itself is the signal.
  const showMarkers = points.length <= 40;

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Trend over ${points.length} periods, peaking at ${format(max)}`}
        preserveAspectRatio="none"
      >
        {/* Recessive gridlines: quarters of the scale, behind everything. */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = padding.top + innerHeight - fraction * innerHeight;
          return (
            <line
              key={fraction}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke={CHART_COLORS.grid}
              strokeWidth={1}
            />
          );
        })}

        <path d={area} fill={color} opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {showMarkers &&
          coords.map((point) => (
            <circle key={point.label} cx={point.x} cy={point.y} r={3} fill={color}>
              <title>{`${point.label}: ${format(point.value)}`}</title>
            </circle>
          ))}

        {coords.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={`label-${point.label}`}
              x={point.x}
              y={height - 6}
              textAnchor="middle"
              fill="#94a3b8"
              style={{ fontSize: 10 }}
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

/**
 * Horizontal bars — clearer than a pie for comparing named categories, and
 * the only form where a long destination name still fits.
 *
 * One hue at varying length: the bar's job is magnitude, so hue would be
 * decoration that implies a difference in kind.
 */
export function BarList({
  rows,
  valueFormatter,
  color = CHART_COLORS.primary,
  emptyMessage = "Nothing to show yet",
  max: maxOverride,
}: {
  rows: { label: string; value: number; secondary?: string; href?: string }[];
  valueFormatter?: (value: number) => string;
  color?: string;
  emptyMessage?: string;
  max?: number;
}) {
  if (rows.length === 0) return <EmptyChart message={emptyMessage} height={140} />;

  const max = maxOverride ?? Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium text-admin-text">{row.label}</span>
            <span className="shrink-0 tabular-nums text-admin-text">
              {valueFormatter ? valueFormatter(row.value) : row.value}
              {row.secondary && (
                <span className="ml-2 text-[11px] text-admin-text-subtle">{row.secondary}</span>
              )}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-admin-muted">
            <div
              className="h-full rounded-full"
              // A 2px floor keeps a non-zero value visible rather than vanishing.
              style={{
                width: `${row.value === 0 ? 0 : Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Conversion funnel. Each stage is drawn relative to the first, and the
 * carry-through from the previous stage is shown as a percentage.
 */
export function Funnel({
  stages,
  emptyMessage = "No enquiries in this period",
}: {
  stages: { stage: string; count: number }[];
  emptyMessage?: string;
}) {
  const top = stages[0]?.count ?? 0;
  if (top === 0) return <EmptyChart message={emptyMessage} height={160} />;

  return (
    <ol className="space-y-2">
      {stages.map((stage, index) => {
        const width = Math.max(4, (stage.count / top) * 100);
        const previous = index > 0 ? stages[index - 1]!.count : null;
        // Guarded against division by zero — a stage after an empty one shows
        // no percentage rather than NaN.
        const retention = previous && previous > 0 ? Math.round((stage.count / previous) * 100) : null;
        const last = index === stages.length - 1;

        return (
          <li key={stage.stage}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-admin-text">{stage.stage}</span>
              <span className="tabular-nums text-admin-text">
                {stage.count}
                {retention !== null && index > 0 && (
                  <span
                    className={cn(
                      "ml-2 text-[11px]",
                      retention >= 50
                        ? "text-admin-success"
                        : retention >= 25
                          ? "text-admin-warning"
                          : "text-admin-danger",
                    )}
                  >
                    {retention}% carried through
                  </span>
                )}
              </span>
            </div>
            <div className="h-6 overflow-hidden rounded-chip bg-admin-muted">
              <div
                className="h-full rounded-chip"
                style={{
                  width: `${width}%`,
                  backgroundColor: last ? CHART_COLORS.success : CHART_COLORS.primary,
                  opacity: last ? 1 : 0.35 + (0.65 * (stages.length - index)) / stages.length,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type ShareRow = {
  label: string;
  count: number;
  percent: number;
  /** Only pass a colour for a state that means something. */
  color?: string;
  href?: string;
};

/**
 * Share of a total — a single stacked bar over a labelled list.
 *
 * Colour is used sparingly on purpose: giving six statuses six hues makes the
 * chart a puzzle to decode, and several of those hues are indistinguishable
 * to a colour-blind reader anyway. Confirmed and cancelled carry colour
 * because those are the two an operations lead is actually scanning for;
 * everything else is a neutral step, and the list beside the bar carries the
 * name, count and share as text.
 */
export function ShareBar({
  rows,
  emptyMessage = "Nothing in this period",
}: {
  rows: ShareRow[];
  emptyMessage?: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return <EmptyChart message={emptyMessage} height={120} />;

  const neutralSteps = [CHART_COLORS.neutral, CHART_COLORS.neutralSoft, "#e2e8f0"];
  let neutralIndex = 0;

  const withColor = rows.map((row) => {
    if (row.color) return { ...row, fill: row.color };
    const fill = neutralSteps[neutralIndex % neutralSteps.length]!;
    neutralIndex += 1;
    return { ...row, fill };
  });

  return (
    <div>
      {/* 2px gaps so adjacent segments read as separate marks, not a gradient. */}
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {withColor.map((row) => (
          <div
            key={row.label}
            style={{ width: `${Math.max(1, row.percent)}%`, backgroundColor: row.fill }}
            className="h-full first:rounded-l-full last:rounded-r-full"
            title={`${row.label}: ${row.count} (${Math.round(row.percent)}%)`}
          />
        ))}
      </div>

      <ul className="mt-3.5 space-y-1.5">
        {withColor.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-[13px]">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.fill }}
            />
            <span className="min-w-0 flex-1 truncate text-admin-text-muted">{row.label}</span>
            <span className="shrink-0 tabular-nums font-medium text-admin-text">{row.count}</span>
            <span className="w-10 shrink-0 text-right tabular-nums text-[11px] text-admin-text-subtle">
              {Math.round(row.percent)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
