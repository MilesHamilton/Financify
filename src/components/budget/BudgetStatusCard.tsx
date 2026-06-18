"use client";

import { useState } from "react";
import { ShieldCheck, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Amount } from "@/components/Amount";

interface BudgetStatusCardProps {
  status: "on_track" | "at_risk";
  daysRemaining: number;
  leftToSpend: string;       // numeric string; may be negative (overspent)
  past30dAvgPerDay: string;  // numeric string
}

export function BudgetStatusCard({
  status,
  daysRemaining,
  leftToSpend,
  past30dAvgPerDay,
}: BudgetStatusCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isOnTrack = status === "on_track";
  const statusColor = isOnTrack
    ? "var(--color-positive)"
    : "var(--color-negative)";

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header — full-width tappable toggle */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          {isOnTrack ? (
            <ShieldCheck size={20} style={{ color: statusColor }} aria-hidden />
          ) : (
            <AlertTriangle size={20} style={{ color: statusColor }} aria-hidden />
          )}
          <span
            className="text-sm font-medium"
            style={{ color: statusColor }}
          >
            {isOnTrack ? "On track" : "At risk"}
          </span>
        </span>
        {expanded ? (
          <ChevronUp size={16} style={{ color: "var(--color-text-muted)" }} aria-hidden />
        ) : (
          <ChevronDown size={16} style={{ color: "var(--color-text-muted)" }} aria-hidden />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div
          className="mt-4 space-y-3"
          style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem" }}
        >
          {/* Days remaining */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Days remaining
            </span>
            <span
              className="tabular-nums text-sm font-medium"
              style={{ color: "var(--color-text)" }}
            >
              {daysRemaining}
            </span>
          </div>

          {/* Left for spending — variant "auto": negative shows red, not capped */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Left for spending
            </span>
            <Amount value={parseFloat(leftToSpend)} variant="auto" size="sm" />
          </div>

          {/* Past 30-day avg */}
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Past 30-day avg
            </span>
            <span className="flex items-baseline gap-0.5">
              <Amount value={parseFloat(past30dAvgPerDay)} variant="neutral" size="sm" />
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                /day
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
