import type { RecurringStream, StreamKind } from '@contract';

import { daysBetween, parseDay, shortDate } from '@/lib/format';

export const FREQ_LABEL: Record<RecurringStream['frequency'], string> = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  SEMI_MONTHLY: 'Twice a month',
  MONTHLY: 'Monthly',
  ANNUALLY: 'Yearly',
};

const PER_MONTH: Record<RecurringStream['frequency'], number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  ANNUALLY: 1 / 12,
};

/** Monthly-equivalent amount, for section totals. */
export const monthlyAmount = (s: RecurringStream) => s.amount * PER_MONTH[s.frequency];

export const KIND_SECTIONS: Array<{ kind: StreamKind; title: string }> = [
  { kind: 'subscription', title: 'Subscriptions' },
  { kind: 'bill', title: 'Bills & Utilities' },
  { kind: 'credit_card', title: 'Credit Card Payments' },
  { kind: 'income', title: 'Income' },
  { kind: 'inactive', title: 'Inactive' },
];

/** "Today" / "Tomorrow" / "in N days" within a week, else "Oct 8". */
export function dueLabel(today: string, date: string): string {
  const n = daysBetween(today, date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1 && n <= 7) return `in ${n} days`;
  return shortDate(date);
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Dates of `s` falling in [from, to] (YYYY-MM-DD), projected forward from nextDate.
 * shortcut: semi-monthly is approximated as every 15 days; use the 1st/15th rule if Plaid exposes it.
 */
export function occurrences(s: RecurringStream, from: string, to: string): string[] {
  if (!s.nextDate) return [];
  const out: string[] = [];
  const d = parseDay(s.nextDate);
  const start = parseDay(s.nextDate).getDate();
  for (let i = 0; i < 60 && iso(d) <= to; i++) {
    if (iso(d) >= from) out.push(iso(d));
    if (s.frequency === 'WEEKLY') d.setDate(d.getDate() + 7);
    else if (s.frequency === 'BIWEEKLY') d.setDate(d.getDate() + 14);
    else if (s.frequency === 'SEMI_MONTHLY') d.setDate(d.getDate() + 15);
    else {
      // Step months from day 1 then clamp, so Jan 31 → Feb 28 → Mar 31.
      d.setDate(1);
      d.setMonth(d.getMonth() + (s.frequency === 'ANNUALLY' ? 12 : 1));
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(start, last));
    }
  }
  return out;
}
