"use client";

import { useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Distance (px) the user must pull before release triggers a refresh */
const THRESHOLD = 72;

/** Maximum visual pull distance rendered (px). Pull beyond this is clamped. */
const MAX_PULL = 120;

/**
 * Resistance divisor: finger travel is divided by this to get visual pull.
 * Higher = heavier feel. 2.5 is the standard iOS-like resistance curve.
 */
const RESISTANCE = 2.5;

interface PullToRefreshProps {
  children: React.ReactNode;
  /** Scroll container element ID to attach touch handlers to. Defaults to "app-scroller" */
  scrollerId?: string;
}

/**
 * PullToRefresh — gesture wrapper implementing FR-040.
 *
 * Architecture:
 * - Wraps page content rendered inside AppShell's inner scroller.
 * - Touch handlers on the scroller div (passed via ref callback from the
 *   host, or found by ID at mount time) detect downward drag when scrollTop === 0.
 * - Resistance curve: visualPull = rawDelta / RESISTANCE (clamped to MAX_PULL).
 * - At release, if visualPull >= THRESHOLD: POST /api/sync/trigger (fire-and-forget,
 *   404/network errors handled gracefully), then startTransition(() => router.refresh()).
 * - isPending from useTransition drives the "refreshing" indicator state.
 *
 * The indicator is a simple spinner that grows in with the pull distance.
 * It is rendered at the top of this wrapper (inside the scroller), so it
 * scrolls with the content — which is correct iOS PTR behaviour.
 */
export function PullToRefresh({
  children,
  scrollerId = "app-scroller",
}: PullToRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Touch tracking refs — no state to avoid re-renders mid-gesture
  const touchStartY = useRef<number>(0);
  const pullDistance = useRef<number>(0);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const isTracking = useRef<boolean>(false);

  /** Apply visual pull to the indicator without triggering a React re-render */
  const setIndicatorPull = useCallback((px: number) => {
    const el = indicatorRef.current;
    if (!el) return;
    el.style.height = `${px}px`;
    el.style.opacity = String(Math.min(px / THRESHOLD, 1));

    // Rotate the spinner arc proportional to pull progress
    const spinner = el.querySelector<SVGElement>("[data-ptr-spinner]");
    if (spinner) {
      const progress = Math.min(px / THRESHOLD, 1);
      spinner.style.opacity = String(progress);
      spinner.style.transform = `rotate(${progress * 180}deg)`;
    }
  }, []);

  const resetIndicator = useCallback(() => {
    setIndicatorPull(0);
    pullDistance.current = 0;
    isTracking.current = false;
  }, [setIndicatorPull]);

  const triggerRefresh = useCallback(() => {
    // POST the sync trigger — fire-and-forget; 404 is fine (route arrives later)
    fetch("/api/sync/trigger", { method: "POST" }).catch(() => {
      // Intentionally ignored: the route may not exist yet
    });

    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  // Attach touch handlers to the scroller element via a stable ref callback
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;

      const handleTouchStart = (e: TouchEvent) => {
        // Only track when the scroller itself is at the very top
        const scroller = document.getElementById(scrollerId);
        if (!scroller || scroller.scrollTop > 0) return;

        touchStartY.current = e.touches[0].clientY;
        isTracking.current = true;
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isTracking.current) return;

        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta <= 0) {
          // Scrolling upward — not a PTR gesture
          isTracking.current = false;
          return;
        }

        // Resistance curve: slow down the visual pull
        const visual = Math.min(delta / RESISTANCE, MAX_PULL);
        pullDistance.current = visual;
        setIndicatorPull(visual);

        // Prevent the browser from native-scrolling during the pull gesture
        if (delta > 0) {
          e.preventDefault();
        }
      };

      const handleTouchEnd = () => {
        if (!isTracking.current) return;

        if (pullDistance.current >= THRESHOLD) {
          triggerRefresh();
        }

        resetIndicator();
      };

      node.addEventListener("touchstart", handleTouchStart, { passive: true });
      node.addEventListener("touchmove", handleTouchMove, { passive: false });
      node.addEventListener("touchend", handleTouchEnd, { passive: true });
      node.addEventListener("touchcancel", resetIndicator, { passive: true });
    },
    [scrollerId, setIndicatorPull, resetIndicator, triggerRefresh],
  );

  return (
    <div ref={containerRef} className="relative min-h-full">
      {/* Pull indicator — zero height at rest, grows during pull */}
      <div
        ref={indicatorRef}
        className="overflow-hidden flex items-end justify-center transition-none"
        style={{ height: 0, opacity: 0 }}
        aria-hidden="true"
      >
        {isPending ? (
          /* Refreshing: spinning loader */
          <RefreshSpinner spinning />
        ) : (
          /* Being pulled: static arc that grows with pull distance */
          <RefreshSpinner spinning={false} />
        )}
      </div>

      {children}
    </div>
  );
}

function RefreshSpinner({ spinning }: { spinning: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-center">
      <svg
        data-ptr-spinner
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className={cn(
          "text-[var(--color-accent)]",
          spinning && "animate-spin",
        )}
        aria-label="Refreshing"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="28 28"
        />
      </svg>
    </div>
  );
}
