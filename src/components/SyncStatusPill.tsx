import { cn } from "@/lib/utils";

interface SyncStatusPillProps {
  /** Timestamp of the most recent successful sync across all items. null = never synced. */
  lastSyncedAt: Date | null;
  /** Count of Plaid items currently in an error state (login_required, revoked, etc.). */
  itemsInError: number;
}

type HealthState = "synced" | "recent" | "stale" | "failed";

function resolveState(lastSyncedAt: Date | null, itemsInError: number): HealthState {
  if (itemsInError > 0 || lastSyncedAt === null) return "failed";
  const ageMs = Date.now() - lastSyncedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours <= 1) return "synced";
  if (ageHours <= 24) return "recent";
  if (ageHours <= 48) return "stale";
  return "failed";
}

function formatRelativeTime(date: Date): string {
  const ageMs = Date.now() - date.getTime();
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const stateConfig: Record<
  HealthState,
  { dotClass: string; label: (date: Date | null) => string }
> = {
  synced: {
    dotClass: "bg-[var(--color-positive)]",
    label: (d) => (d ? `Updated ${formatRelativeTime(d)}` : "Up to date"),
  },
  recent: {
    dotClass: "bg-[var(--color-text-muted)]",
    label: (d) => (d ? `Updated ${formatRelativeTime(d)}` : "Up to date"),
  },
  stale: {
    dotClass: "bg-[var(--color-chart-3)]",
    label: () => "Data may be stale",
  },
  failed: {
    dotClass: "bg-[var(--color-negative)]",
    label: () => "Last sync failed",
  },
};

export function SyncStatusPill({ lastSyncedAt, itemsInError }: SyncStatusPillProps) {
  const state = resolveState(lastSyncedAt, itemsInError);
  const { dotClass, label } = stateConfig[state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClass)} />
      {label(lastSyncedAt)}
    </span>
  );
}
