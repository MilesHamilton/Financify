import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  tabBar: React.ReactNode;
  className?: string;
}

/**
 * AppShell — fixed-body/inner-scroller layout.
 *
 * CRITICAL: html/body never scroll. The inner div is THE scroller.
 * Pull-to-refresh and sticky headers both depend on this layout from day one.
 * (FR-040, output-rendering.md § Scroll Architecture)
 *
 * Safe-area top: env(safe-area-inset-top) pads under the black-translucent
 * status bar (viewport-fit=cover in layout.tsx viewport export).
 * TabBar is rendered outside the scroller, fixed at the bottom.
 */
export function AppShell({ children, tabBar, className }: AppShellProps) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[var(--color-canvas)]">
      {/* Inner scroller — the only element that scrolls in the app */}
      <div
        id="app-scroller"
        className={cn(
          "flex-1 overflow-y-auto overscroll-none",
          // Safe-area top padding for black-translucent status bar
          "pt-[env(safe-area-inset-top)]",
          className,
        )}
        // Required for smooth momentum scrolling on iOS
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>

      {/* TabBar sits outside the scroller, anchored to the bottom */}
      {tabBar}
    </div>
  );
}
