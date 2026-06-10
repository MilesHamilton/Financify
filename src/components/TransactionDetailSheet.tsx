"use client";

/**
 * TransactionDetailSheet — client component.
 *
 * Bottom sheet for a single transaction:
 *   - Full details (merchant, amount, date, account, note)
 *   - Category picker (scrollable list of all categories)
 *   - Exclude toggle
 *   - Note textarea
 *   - "Always categorize <merchant> like this" → POST /api/category-rules then
 *     PUT /api/category-rules/:id/apply
 *
 * Saves via PATCH /api/transactions/:id then calls router.refresh().
 * Error messages are shown inline.
 *
 * Amount display: Plaid positive = outflow; negate for display (FR-048).
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Amount } from "@/components/Amount";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "@/domain/metrics";

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  group: string;
}

interface TransactionDetailSheetProps {
  transaction: TransactionRow;
  categories: Category[];
  open: boolean;
  onClose: () => void;
}

export function TransactionDetailSheet({
  transaction,
  categories,
  open,
  onClose,
}: TransactionDetailSheetProps) {
  const router = useRouter();

  // Local editable state — initialized from transaction on open.
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    transaction.categoryId,
  );
  const [isExcluded, setIsExcluded] = useState(transaction.isExcluded);
  const [note, setNote] = useState(transaction.note ?? "");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Async state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ruleApplying, setRuleApplying] = useState(false);
  const [ruleSuccess, setRuleSuccess] = useState(false);

  // Animated slide state
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync local state when the transaction prop changes (e.g. after refresh).
  // Render-time state adjustment (React's sanctioned pattern) instead of an
  // effect — avoids the extra cascading render the lint rule flags.
  const [prevTransaction, setPrevTransaction] = useState(transaction);
  if (transaction !== prevTransaction) {
    setPrevTransaction(transaction);
    setSelectedCategoryId(transaction.categoryId);
    setIsExcluded(transaction.isExcluded);
    setNote(transaction.note ?? "");
    setShowCategoryPicker(false);
    setError(null);
    setRuleSuccess(false);
  }

  // Drive slide-up / slide-down animation. Both directions go through rAF so
  // the element is mounted before the visible class lands (and no synchronous
  // setState runs inside the effect body).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(open));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Close on backdrop click or Escape key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll while sheet is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open && !visible) return null;

  const selectedCategory =
    categories.find((c) => c.id === selectedCategoryId) ??
    categories.find((c) => c.id === transaction.categoryId);

  const displayName = transaction.merchantName ?? transaction.name;
  const displayAmount = -parseFloat(transaction.amount);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (selectedCategoryId !== transaction.categoryId) {
        body.categoryId = selectedCategoryId;
      }
      if (isExcluded !== transaction.isExcluded) {
        body.isExcluded = isExcluded;
      }
      const trimmedNote = note.trim();
      const originalNote = transaction.note ?? "";
      if (trimmedNote !== originalNote) {
        body.note = trimmedNote || null;
      }

      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Save failed");
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRule() {
    if (!transaction.merchantName) return;
    setRuleApplying(true);
    setError(null);
    setRuleSuccess(false);
    try {
      // 1. Create the rule (merchantNameLike = merchant name).
      const createRes = await fetch("/api/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantNameLike: transaction.merchantName,
          setCategoryId: selectedCategoryId,
        }),
      });
      if (!createRes.ok) {
        const json = (await createRes.json()) as { error?: string };
        throw new Error(json.error ?? "Rule creation failed");
      }
      const createdRule = (await createRes.json()) as { id: string };

      // 2. Apply the rule to all existing non-user-categorized transactions.
      const applyRes = await fetch(
        `/api/category-rules/${createdRule.id}/apply`,
        { method: "PUT" },
      );
      if (!applyRes.ok) {
        const json = (await applyRes.json()) as { error?: string };
        throw new Error(json.error ?? "Rule apply failed");
      }

      setRuleSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rule creation failed");
    } finally {
      setRuleApplying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Transaction detail: ${displayName}`}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] transition-transform duration-300",
          "pb-[env(safe-area-inset-bottom)]",
          visible ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
        </div>

        <div className="px-4 pb-6 pt-2">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-[var(--color-text)]">
                {displayName}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {transaction.date}
                {transaction.pending && (
                  <span className="ml-2 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                    Pending
                  </span>
                )}
              </p>
            </div>
            <Amount value={displayAmount} variant="auto" size="lg" />
          </div>

          {/* Category picker toggle */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Category
            </label>
            <button
              type="button"
              onClick={() => setShowCategoryPicker((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-left transition-colors active:opacity-70"
            >
              {selectedCategory && (
                <CategoryIcon
                  iconName={selectedCategory.icon}
                  colorToken={selectedCategory.color}
                  iconSize={14}
                />
              )}
              <span className="flex-1 truncate text-sm text-[var(--color-text)]">
                {selectedCategory?.label ?? "Uncategorized"}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {showCategoryPicker ? "Done" : "Change"}
              </span>
            </button>
          </div>

          {/* Category list */}
          {showCategoryPicker && (
            <div className="mb-4 max-h-48 overflow-y-auto rounded-xl bg-[var(--color-surface-2)]">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setShowCategoryPicker(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                    cat.id === selectedCategoryId &&
                      "bg-[var(--color-border)]",
                  )}
                >
                  <CategoryIcon
                    iconName={cat.icon}
                    colorToken={cat.color}
                    iconSize={14}
                  />
                  <span className="flex-1 truncate text-sm text-[var(--color-text)]">
                    {cat.label}
                  </span>
                  {cat.id === selectedCategoryId && (
                    <span className="text-xs text-[var(--color-accent)]">
                      Selected
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* "Always categorize" merchant rule — only shown when a merchant name is available */}
          {transaction.merchantName &&
            selectedCategoryId !== transaction.categoryId && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleCreateRule}
                  disabled={ruleApplying || ruleSuccess}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    ruleSuccess
                      ? "bg-[var(--color-positive)]/10 text-[var(--color-positive)]"
                      : "bg-[var(--color-accent)]/10 text-[var(--color-accent)] active:opacity-70",
                    (ruleApplying || ruleSuccess) && "opacity-60",
                  )}
                >
                  {ruleSuccess
                    ? `Rule created for ${transaction.merchantName}`
                    : ruleApplying
                      ? "Creating rule..."
                      : `Always categorize ${transaction.merchantName} like this`}
                </button>
              </div>
            )}

          {/* Exclude toggle */}
          <div className="mb-4 flex items-center justify-between rounded-xl bg-[var(--color-surface-2)] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                Exclude from totals
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Hidden from spending calculations
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isExcluded}
              onClick={() => setIsExcluded((v) => !v)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                isExcluded
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-border)]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  isExcluded ? "translate-x-5" : "translate-x-0.5",
                )}
              />
              <span className="sr-only">
                {isExcluded ? "Included" : "Excluded"}
              </span>
            </button>
          </div>

          {/* Note */}
          <div className="mb-6">
            <label
              htmlFor="txn-note"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
            >
              Note
            </label>
            <textarea
              id="txn-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full resize-none rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="mb-4 rounded-xl bg-[var(--color-negative)]/10 px-3 py-2 text-sm text-[var(--color-negative)]">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-[var(--color-surface-2)] py-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors active:opacity-70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-white transition-colors active:opacity-70 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
