import { Suspense } from "react";
import { CalendarClock } from "lucide-react";

import { getRecurringMonth, currentNYMonth, type RecurringMonthResult } from "@/domain/metrics";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { RecurringSummaryCard } from "@/components/recurring/RecurringSummaryCard";
import { RecurringSection } from "@/components/recurring/RecurringSection";

export const dynamic = "force-dynamic";

/** Full month name for the current NY month, e.g. "July" (design source line 231). */
function monthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(parsed);
}

const EMPTY_RESULT: RecurringMonthResult = {
  leftToPay: "0.00",
  paidSoFar: "0.00",
  upcoming: [],
  paid: [],
};

export default async function RecurringPage() {
  const month = currentNYMonth();

  // Any failure (e.g. no DB in this env) degrades to the empty state below
  // rather than throwing — this screen must always render (FRD AC-4).
  let data: RecurringMonthResult;
  try {
    data = await getRecurringMonth(month);
  } catch {
    data = EMPTY_RESULT;
  }

  const hasStreams = data.upcoming.length > 0 || data.paid.length > 0;

  return (
    <div className="flex flex-col gap-1 px-4 pb-6 pt-2">
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          padding: "6px 2px 14px",
          color: "var(--color-text)",
        }}
      >
        Recurring
      </h1>

      {!hasStreams ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            headline="No recurring bills yet"
            body="No recurring bills detected yet — they'll appear here after your next sync once your bank connection reports recurring transactions."
          />
        </Card>
      ) : (
        <Suspense
          fallback={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-[92px]" />
              <Skeleton className="h-[280px]" />
              <Skeleton className="h-[320px]" />
            </div>
          }
        >
          <RecurringSummaryCard
            monthLabel={monthLabel(month)}
            leftToPay={data.leftToPay}
            paidSoFar={data.paidSoFar}
          />
          <RecurringSection title="UPCOMING" items={data.upcoming} variant="upcoming" />
          <RecurringSection
            title="PAID THIS MONTH"
            items={data.paid}
            variant="paid"
          />
        </Suspense>
      )}
    </div>
  );
}
