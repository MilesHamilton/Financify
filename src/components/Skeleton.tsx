import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Fixed-height shimmer placeholder used as Suspense fallbacks.
 * Callers control height via className (e.g. "h-24").
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface)]",
        className,
      )}
    />
  );
}
