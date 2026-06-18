"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// SavingsTargetEditor
// ---------------------------------------------------------------------------

interface SavingsTargetEditorProps {
  currentTarget: string;
}

export function SavingsTargetEditor({
  currentTarget,
}: SavingsTargetEditorProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(parseFloat(currentTarget).toFixed(0));
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
    setValue(parseFloat(currentTarget).toFixed(0));
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
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlySavingsTarget: amount }),
      });

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

  const displayValue = saved
    ? `$${parseFloat(value).toFixed(0)}`
    : `$${parseFloat(currentTarget).toFixed(0)}`;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm" style={{ color: "var(--color-text)" }}>
        Monthly savings target
      </span>

      {!open ? (
        <div className="flex items-center gap-2">
          <span
            className="text-sm tabular-nums"
            style={{ color: "var(--color-text)" }}
          >
            {displayValue}
          </span>
          <button
            onClick={handleEdit}
            aria-label="Edit monthly savings target"
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
              aria-label="Monthly savings target amount"
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

// ---------------------------------------------------------------------------
// IncomeOverrideEditor
// ---------------------------------------------------------------------------

interface IncomeOverrideEditorProps {
  currentOverride: string | null;
}

export function IncomeOverrideEditor({
  currentOverride,
}: IncomeOverrideEditorProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    currentOverride != null ? parseFloat(currentOverride).toFixed(0) : ""
  );
  // null means the override was cleared (auto mode); undefined means untouched
  const [savedOverride, setSavedOverride] = useState<string | null | undefined>(
    undefined
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleEdit() {
    setOpen(true);
    setError(null);
  }

  function handleCancel() {
    setOpen(false);
    setError(null);
    setValue(
      currentOverride != null ? parseFloat(currentOverride).toFixed(0) : ""
    );
  }

  async function sendRequest(body: { monthlyIncomeOverride: number | null }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const resBody = (await res.json().catch(() => ({}))) as {
          details?: string;
          error?: string;
        };
        throw new Error(
          resBody.details ?? resBody.error ?? `Error ${res.status}`
        );
      }

      setOpen(false);
      setSavedOverride(
        body.monthlyIncomeOverride != null
          ? String(body.monthlyIncomeOverride)
          : null
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount < 0) {
      setError("Enter a valid amount (0 or more).");
      return;
    }
    await sendRequest({ monthlyIncomeOverride: amount });
  }

  async function handleClear() {
    setValue("");
    await sendRequest({ monthlyIncomeOverride: null });
  }

  // Resolve what to display. savedOverride=undefined means we haven't saved
  // anything yet this session, so fall back to the prop.
  const effectiveOverride =
    savedOverride !== undefined ? savedOverride : currentOverride;

  const hasOverride = effectiveOverride != null;

  const displayValue = hasOverride
    ? `$${parseFloat(effectiveOverride).toFixed(0)}`
    : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm" style={{ color: "var(--color-text)" }}>
        Monthly income
      </span>

      {!open ? (
        <div className="flex items-center gap-2">
          <span
            className="text-sm tabular-nums"
            style={{
              color: hasOverride
                ? "var(--color-text)"
                : "var(--color-text-muted)",
            }}
          >
            {displayValue ?? "Auto (3-month average)"}
          </span>
          <button
            onClick={handleEdit}
            aria-label="Edit monthly income override"
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
              aria-label="Monthly income override amount"
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
          {/* Clear button — shown when there is an existing override or the
              input is blank (user has erased the value). */}
          {(hasOverride || value === "") && (
            <button
              onClick={handleClear}
              disabled={busy}
              className="text-xs"
              style={{
                color: "var(--color-text-muted)",
                opacity: busy ? 0.6 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Use auto
            </button>
          )}
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
