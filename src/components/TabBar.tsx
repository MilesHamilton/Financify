"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LayoutDashboard, Repeat, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

// Order matches the prototype (dc.html TABS array) and FRD §2:
// Budget, Dashboard, Recurring, Settings.
const TABS: TabItem[] = [
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * TabBar — bottom navigation bar (4 equal-width tabs).
 *
 * Active state is derived from usePathname. "/" is active only on exact
 * match (otherwise it would light up on every route); the other three
 * routes are active when pathname starts with their href.
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
        "bg-[var(--color-tab-bar-bg)] border-t border-[var(--color-border)]",
        // Safe-area bottom padding for iPhone home indicator
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex items-stretch">
        {TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(tab.href)} />
        ))}
      </div>
    </nav>
  );
}

interface TabLinkProps {
  tab: TabItem;
  active: boolean;
}

function TabLink({ tab, active }: TabLinkProps) {
  const Icon = tab.icon;

  return (
    <Link
      href={tab.href}
      prefetch
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
        active ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]",
      )}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-[22px] shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-semibold leading-none">
        {tab.label}
      </span>
    </Link>
  );
}
