"use client";

/**
 * NotificationsToggle — T-R43
 *
 * VISUAL-ONLY STUB. There is no notifications feature, API, or persistence
 * layer in this codebase yet — this toggle only flips local component state
 * so the pill/knob matches the prototype (46x28 track, sliding 24px knob).
 * Flipping it does nothing outside this component and resets on reload.
 * Wire up real persistence + a notifications API before treating this as
 * functional.
 */

import { useState } from "react";

export function NotificationsToggle() {
  const [on, setOn] = useState(true);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      aria-label="Notifications (visual only — not yet persisted)"
      className="shrink-0"
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        padding: 2,
        background: on ? "var(--color-accent)" : "var(--color-surface-2)",
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: "var(--color-text)",
          display: "block",
        }}
      />
    </button>
  );
}
