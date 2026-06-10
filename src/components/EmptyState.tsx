import type { ReactNode, ElementType } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon component to display above the headline. */
  icon: ElementType<LucideProps>;
  headline: string;
  body: string;
  /** Optional CTA button / link rendered below the body. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  headline,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-2)]"
        aria-hidden="true"
      >
        <Icon size={24} className="text-[var(--color-text-muted)]" />
      </span>
      <p className="text-base font-semibold text-[var(--color-text)]">{headline}</p>
      <p className="max-w-xs text-sm text-[var(--color-text-muted)]">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
