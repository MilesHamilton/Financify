"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ChartPie,
  List,
  Wallet,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Render smaller — used for the Settings utility link */
  small?: boolean;
}

const TABS: TabItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/spending", label: "Spending", icon: ChartPie },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/accounts", label: "Accounts", icon: Wallet },
];

const SETTINGS_TAB: TabItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
  small: true,
};

/**
 * TabBar — bottom navigation bar.
 *
 * Active state is derived from usePathname. "/" is active only on exact match;
 * other routes are active when pathname starts with their href.
 *
 * padding-bottom: env(safe-area-inset-bottom) prevents content from being
 * clipped by the iPhone home indicator (viewport-fit=cover).
 * (output-rendering.md § Template-Component System, FR-046)
 */
export function TabBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className={cn(
        "w-full shrink-0",
        "bg-[var(--color-surface)] border-t border-[var(--color-border)]",
        // Safe-area bottom padding for iPhone home indicator
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex items-stretch">
        {/* Four main tabs — equal width */}
        {TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(tab.href)} />
        ))}

        {/* Smaller Settings link */}
        <TabLink
          tab={SETTINGS_TAB}
          active={isActive(SETTINGS_TAB.href)}
          compact
        />
      </div>
    </nav>
  );
}

interface TabLinkProps {
  tab: TabItem;
  active: boolean;
  /** Renders at narrower width with smaller icon/text */
  compact?: boolean;
}

function TabLink({ tab, active, compact }: TabLinkProps) {
  const Icon = tab.icon;

  return (
    <Link
      href={tab.href}
      prefetch
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
        compact ? "w-10 shrink-0" : "flex-1",
        active
          ? "text-[var(--color-accent)]"
          : "text-[var(--color-text-muted)]",
      )}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        className={cn(
          "shrink-0",
          compact ? "size-4" : "size-5",
        )}
        aria-hidden="true"
      />
      {!compact && (
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]",
          )}
        >
          {tab.label}
        </span>
      )}
    </Link>
  );
}
