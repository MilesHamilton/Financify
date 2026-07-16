/** One slice of the spend donut. */
export interface DonutSegment {
  color: string;
  /** Spend for this segment in dollars (positive). */
  value: number;
}

interface SpendDonutProps {
  segments: DonutSegment[];
  /** Total spend across all segments (denominator). */
  total: number;
  /** Formatted total-spend string shown in the center (e.g. "$3,641"). */
  centerValue: string;
}

// r=55, stroke-width=16, 140×140 viewBox — matches the prototype exactly.
const R = 55;
const C = 2 * Math.PI * R;

/**
 * Plain-SVG donut. Each category becomes one arc drawn with stroke-dasharray /
 * stroke-dashoffset derived from the circumference C = 2πr (r=55). A 3px gap is
 * subtracted from each arc length and the offset accumulates around the ring,
 * exactly as the prototype's script computes it. Rotated -90° so the first arc
 * starts at 12 o'clock.
 */
export function SpendDonut({ segments, total, centerValue }: SpendDonutProps) {
  let acc = 0;
  const arcs =
    total > 0
      ? segments
          .filter((s) => s.value > 0)
          .map((s, i) => {
            const frac = s.value / total;
            const len = Math.max(0, frac * C - 3);
            const dash = `${len.toFixed(1)} ${(C - len).toFixed(1)}`;
            const offset = (-acc).toFixed(1);
            acc += frac * C;
            return { key: `${s.color}-${i}`, color: s.color, dash, offset };
          })
      : [];

  return (
    <div className="relative h-[140px] w-[140px] shrink-0">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="16"
        />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="16"
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          Spent
        </span>
        <span
          className="text-[19px] font-bold"
          style={{ letterSpacing: "-0.5px" }}
        >
          {centerValue}
        </span>
      </div>
    </div>
  );
}
