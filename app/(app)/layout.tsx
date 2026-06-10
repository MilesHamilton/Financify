import { AppShell } from "@/components/AppShell";
import { TabBar } from "@/components/TabBar";
import { PullToRefresh } from "@/components/PullToRefresh";
import { RevalidateOnFocus } from "@/components/RevalidateOnFocus";
import { ErrorBoundaryCard } from "@/components/ErrorBoundaryCard";

/**
 * Authenticated app group layout — wraps all routes under app/(app)/.
 *
 * Composition:
 *   AppShell (server) — fixed-body/inner-scroller layout with safe-area padding
 *     tabBar={<TabBar />} — bottom tab navigation (client)
 *     RevalidateOnFocus   — visibilitychange → router.refresh() (client, no DOM)
 *     PullToRefresh       — gesture wrapper + sync trigger (client)
 *       ErrorBoundaryCard — per-screen error boundary catching client render errors
 *         {children}      — the actual page (RSC)
 *
 * Login (/login) and offline (/~offline) live outside this group, so they
 * never receive the tab bar or the pull-to-refresh chrome.
 * (FR-037, output-rendering.md § Template-Component System)
 */
export default function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell tabBar={<TabBar />}>
      <RevalidateOnFocus />
      <PullToRefresh>
        <ErrorBoundaryCard>{children}</ErrorBoundaryCard>
      </PullToRefresh>
    </AppShell>
  );
}
