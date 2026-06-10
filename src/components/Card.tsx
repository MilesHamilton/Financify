import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  /** Optional heading rendered in the top-left of the card. */
  title?: string;
  /**
   * Optional element placed in the top-right of the title row
   * (e.g. a "See all" link or a badge).
   */
  titleAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, titleAction, children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-[var(--color-surface)] p-4",
        className,
      )}
    >
      {(title || titleAction) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              {title}
            </h2>
          )}
          {titleAction && <div>{titleAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
