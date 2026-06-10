"use client";

/**
 * BudgetEditor — FR-034, FR-035
 *
 * Inline budget editor for a single expense category.
 * Displays the current budget amount (or "No budget") and a pencil button.
 * When open, shows a number input and Save/Cancel.
 *
 * POST /api/budgets body: { categoryId, amount }
 * 409 response: a budget for the *current* month already exists — FR-035
 * says POST always appends a new row for effective_month = current month.
 * On 409 we explain the next-month rule: the existing budget is in effect
 * for the rest of this month; the new amount will take effect next month
 * if the user retries after the month rolls over.
 */

import { useState } from "react";

interface BudgetEditorProps {
  categoryId: string;
  categoryLabel: string;
  currentBudget: string | null;
}

export function BudgetEditor({
  categoryId,
  categoryLabel,
  currentBudget,
}: BudgetEditorProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    currentBudget != null ? parseFloat(currentBudget).toFixed(0) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleEdit() {
    setOpen(true);
    setSaved(false);
    setError(null);
  }

  function handleCancel() {
    setOpen(false);
    setError(null);
    // Restore to last saved / initial value
    setValue(currentBudget != null ? parseFloat(currentBudget).toFixed(0) : "");
  }

  async function handleSave() {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) {
      setError("Enter a valid amount (0 or more).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, amount }),
      });

      if (res.status === 409) {
        // FR-035: a row already exists for (categoryId, current effective_month).
        // Budget history is never overwritten — explain next-month rule.
        setError(
          "A budget for this category was already set this month. " +
            "Your change will take effect next month — a new budget row " +
            "can only be created once per month per category."
        );
        setBusy(false);
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          details?: string;
          error?: string;
        };
        throw new Error(body.details ?? body.error ?? `Error ${res.status}`);
      }

      setOpen(false);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const displayBudget =
    saved && value !== ""
      ? `$${parseFloat(value).toFixed(0)}`
      : currentBudget != null
      ? `$${parseFloat(currentBudget).toFixed(0)}`
      : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm" style={{ color: "var(--color-text)" }}>
        {categoryLabel}
      </span>

      {!open ? (
        <div className="flex items-center gap-2">
          <span
            className="text-sm tabular-nums"
            style={{
              color: displayBudget
                ? "var(--color-text)"
                : "var(--color-text-muted)",
            }}
          >
            {displayBudget ?? "No budget"}
          </span>
          <button
            onClick={handleEdit}
            aria-label={`Edit budget for ${categoryLabel}`}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
            }}
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              $
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-24 rounded px-2 py-1 text-sm text-right tabular-nums"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
              autoFocus
              aria-label={`Budget amount for ${categoryLabel}`}
            />
            <button
              onClick={handleSave}
              disabled={busy}
              className="text-xs px-2.5 py-1 rounded font-medium"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                opacity: busy ? 0.6 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "…" : "Save"}
            </button>
            <button
              onClick={handleCancel}
              disabled={busy}
              className="text-xs px-2.5 py-1 rounded"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p
              className="text-xs max-w-xs text-right"
              style={{ color: "var(--color-negative)" }}
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
