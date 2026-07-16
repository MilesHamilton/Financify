interface CashBalanceAreaProps {
  /** Balance snapshot values in chronological order (>= 2 points required). */
  points: number[];
  /** Formatted end-balance, e.g. "$4,820". */
  endValue: string;
  /** Formatted delta label, e.g. "+$310 this month". */
  deltaLabel: string;
  /** True → green, false → red. */
  deltaPositive: boolean;
  /** Left tick label, e.g. "Jul 1". */
  startTick: string;
  /** Right tick label, e.g. "Today". */
  endTick: string;
}

/**
 * Cash-balance card: caption + end balance, sign-colored delta top-right, and a
 * plain-SVG area+line built from balance snapshots. Geometry mirrors the
 * prototype: viewBox 0 0 340 110, preserveAspectRatio none, x mapped across
 * 2..338, y normalized into 8..100 (92px band), area closed to y=108.
 */
export function CashBalanceArea({
  points,
  endValue,
  deltaLabel,
  deltaPositive,
  startTick,
  endTick,
}: CashBalanceAreaProps) {
  const n = points.length;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const x = (i: number) => (((i / (n - 1)) * 336 + 2)).toFixed(1);
  const y = (v: number) => (100 - ((v - lo) / (hi - lo || 1)) * 92).toFixed(1);

  const balPath = points
    .map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`)
    .join(" ");
  const balArea = `${balPath} L${x(n - 1)} 108 L${x(0)} 108 Z`;

  return (
    <div
      className="mt-4 rounded-[var(--radius-card)] p-4"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Cash balance
          </div>
          <div
            className="text-xl font-bold"
            style={{ letterSpacing: "-0.5px" }}
          >
            {endValue}
          </div>
        </div>
        <span
          className="text-[13px] font-semibold"
          style={{
            color: deltaPositive
              ? "var(--color-positive)"
              : "var(--color-negative)",
          }}
        >
          {deltaLabel}
        </span>
      </div>

      <svg
        width="100%"
        height="110"
        viewBox="0 0 340 110"
        preserveAspectRatio="none"
        className="mt-2.5 block"
      >
        <path d={balArea} fill="rgba(108,140,255,0.12)" />
        <path
          d={balPath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <div
        className="mt-1.5 flex justify-between text-[11px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>{startTick}</span>
        <span>{endTick}</span>
      </div>
    </div>
  );
}
