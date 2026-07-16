"use client";

/**
 * ExpandableEditorRow — T-R43
 *
 * Prototype trigger-row styling (label flex-1, muted value, ChevronRight)
 * wrapped around a disclosure so tapping it reveals the *existing* editor
 * component(s) passed as children, unchanged. This is how the redesigned
 * Settings screen keeps every pre-existing editor (IncomeOverrideEditor,
 * per-category BudgetEditor, SavingsTargetEditor) working behind a single
 * compact row instead of always-open lists.
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface ExpandableEditorRowProps {
  label: string;
  value: string;
  /** Suppress the row's own bottom border (used for the last row in a card). */
  isLast?: boolean;
  children: React.ReactNode;
}

export function ExpandableEditorRow({
  label,
  value,
  isLast,
  children,
}: ExpandableEditorRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderBottom: isLast && !open ? "none" : "1px solid var(--color-border)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3.5 text-left"
      >
        <span
          className="flex-1 text-[15px] font-medium"
          style={{ color: "var(--color-text)" }}
        >
          {label}
        </span>
        <span className="text-[15px]" style={{ color: "var(--color-text-muted)" }}>
          {value}
        </span>
        <ChevronRight
          size={14}
          aria-hidden="true"
          style={{
            color: "var(--color-text-muted)",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 150ms",
            flexShrink: 0,
          }}
        />
      </button>
      {open && (
        <div
          className="pb-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
