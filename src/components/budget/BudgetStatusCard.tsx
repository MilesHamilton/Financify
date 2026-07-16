/**
 * Budget screen presentational cards (T-R40).
 *
 * Reworked from the old expandable "on track / at risk" card into the set of
 * presentational cards the redesigned /budget screen needs, matching the
 * prototype markup (Financify Redesign.dc.html lines 50–109):
 *
 *   • BudgetMetricCard — the Spending / Bills & Utilities / Earnings cards
 *     (icon, optional green day-chip, caption, headline, progress bar, footer).
 *   • SavingsTargetCard — the "Projected Savings" card with risk pill, mini
 *     savings-vs-target bar, and the at-risk advice footer.
 *
 * These are pure presentational components (no client interactivity) so they
 * render inside the server component page. All colors come from globals.css
 * tokens (T-R60).
 */

import { PiggyBank, Info, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// BudgetMetricCard — Spending / Bills & Utilities / Earnings
// ---------------------------------------------------------------------------

interface BudgetMetricCardProps {
  /** Lucide icon shown top-left (Wallet / Receipt / PiggyBank etc). */
  icon: LucideIcon;
  /** Muted caption above the headline (e.g. "Spending"). */
  caption: string;
  /** Big headline, e.g. "$1,305 left to spend". */
  headline: string;
  /** When true, the headline renders in the negative (red) color. */
  negative?: boolean;
  /** Progress fill, 0–1. Clamped for the bar width. */
  pct: number;
  /** Footer left label (e.g. "$1,291 spent"). */
  footerLeft: string;
  /** Optional footer right label (e.g. "$2,596 budgeted"). */
  footerRight?: string;
  /**
   * Optional green day-chip shown top-right (e.g. "$82/day for 16d").
   * Only pass this when viewing the current month.
   */
  chip?: string | null;
}

export function BudgetMetricCard({
  icon: Icon,
  caption,
  headline,
  negative = false,
  pct,
  footerLeft,
  footerRight,
  chip,
}: BudgetMetricCardProps) {
  const width = `${Math.min(100, Math.max(0, pct * 100))}%`;

  return (
    <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] px-4 py-[18px]">
      <div className="flex items-start justify-between">
        <Icon size={22} style={{ color: "var(--color-text)" }} aria-hidden />
        {chip ? (
          <span
            className="rounded-full px-3 py-[5px] text-[13px] font-semibold"
            style={{
              background: "var(--color-chip-green-bg)",
              color: "var(--color-chip-green-fg)",
            }}
          >
            {chip}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 text-sm text-[var(--color-text-muted)]">
        {caption}
      </div>
      <div
        className="mt-0.5 text-2xl font-bold tracking-[-0.5px]"
        style={{
          color: negative ? "var(--color-negative)" : "var(--color-text)",
        }}
      >
        {headline}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)]"
          style={{ width }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[13px] text-[var(--color-text-muted)]">
        <span>{footerLeft}</span>
        {footerRight ? <span>{footerRight}</span> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SavingsTargetCard — Projected Savings + risk pill + mini bar + advice
// ---------------------------------------------------------------------------

interface SavingsTargetCardProps {
  /** "Projected Savings" (current month) or "Saved" (past month). */
  caption: string;
  /** Big projected-savings number, e.g. "$504". */
  projectedLabel: string;
  /** Sub-label, e.g. "Of $1,500 Target". */
  ofTargetLabel: string;
  /** "At Risk" / "On Track" / "Target Met" / "Missed". */
  riskLabel: string;
  /** When true the pill uses the amber tint; otherwise green. */
  atRisk: boolean;
  /** Target tick label above the dashed line (e.g. "$1.5k"). */
  targetTick: string;
  /** Savings-bar height ratio, 0–1 (CLAMP(projectedSavings / target)). */
  savingsBarPct: number;
  /** When present, renders the advice footer (shown current month + at risk). */
  advice?: { title: string; body: string } | null;
}

export function SavingsTargetCard({
  caption,
  projectedLabel,
  ofTargetLabel,
  riskLabel,
  atRisk,
  targetTick,
  savingsBarPct,
  advice,
}: SavingsTargetCardProps) {
  // Prototype: Math.round(min(1, projected/target) * 52 + 6) + 'px'
  const barHeight = `${Math.round(Math.min(1, Math.max(0, savingsBarPct)) * 52 + 6)}px`;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)]">
      <div className="flex gap-3 px-4 py-[18px]">
        {/* Left column — projected savings */}
        <div className="flex-1">
          <PiggyBank size={22} style={{ color: "var(--color-text)" }} aria-hidden />
          <div className="mt-2.5 text-sm text-[var(--color-text-muted)]">
            {caption}
          </div>
          <div className="mt-0.5 text-[34px] font-bold leading-none tracking-[-1px] text-[var(--color-text)]">
            {projectedLabel}
          </div>
          <div className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {ofTargetLabel}
          </div>
        </div>

        {/* Right column — risk pill + mini savings bar */}
        <div className="flex w-[130px] flex-col items-end gap-2">
          <span
            className="flex items-center gap-[5px] rounded-full px-3 py-[5px] text-[13px] font-semibold"
            style={{
              background: atRisk
                ? "var(--color-chip-amber-bg)"
                : "var(--color-chip-green-bg)",
              color: atRisk
                ? "var(--color-chip-amber-fg)"
                : "var(--color-chip-green-fg)",
            }}
          >
            {riskLabel}
            <Info size={13} aria-hidden style={{ color: "currentColor" }} />
          </span>

          <div className="relative min-h-[78px] w-full flex-1">
            {/* Dashed target line + tick */}
            <div className="absolute left-0 right-0 top-[6px] flex items-center gap-1.5">
              <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                {targetTick}
              </span>
              <div
                className="flex-1"
                style={{ borderTop: "2px dashed var(--color-dashed-line)" }}
              />
            </div>
            {/* $0 baseline */}
            <span className="absolute bottom-0 left-0 text-[11px] text-[var(--color-text-muted)]">
              $0
            </span>
            {/* Savings bar */}
            <div
              className="absolute bottom-0 right-2 w-14 rounded-t-lg"
              style={{
                height: barHeight,
                background: "var(--color-savings-bar)",
                border: "2px solid var(--color-accent)",
                borderBottom: "none",
              }}
            />
          </div>
        </div>
      </div>

      {advice ? (
        <div
          className="px-4 py-[14px]"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div className="text-[15px] font-bold text-[var(--color-text)]">
            {advice.title}
          </div>
          <div className="mt-1 text-sm leading-[1.45] text-[var(--color-text-muted)]">
            {advice.body}
          </div>
        </div>
      ) : null}
    </div>
  );
}
