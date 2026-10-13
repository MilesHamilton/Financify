import type { DailySpendDay, DailySpendResponse } from '@contract';
import {
  CircleAlert,
  CircleCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import type { ChipVariant } from '@/components/ui';
import { money, parseDay } from '@/lib/format';
import { useApi } from '@/lib/use-api';

/**
 * Last daily-spend response (read by the day / goal sheets) plus a version
 * counter: bumping it makes every mounted useDailySpend refetch.
 */
export const useDailySpendStore = create<{ data: DailySpendResponse | null; version: number; invalidate: () => void }>(
  (set) => ({ data: null, version: 0, invalidate: () => set((s) => ({ version: s.version + 1 })) }),
);

export function useDailySpend(month?: string) {
  const version = useDailySpendStore((s) => s.version);
  const q = useApi<DailySpendResponse>(`/api/mobile/daily-spend${month ? `?month=${month}` : ''}`);
  const { data, refresh } = q;
  useEffect(() => {
    if (data) useDailySpendStore.setState({ data });
  }, [data]);
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    void refresh();
  }, [version, refresh]);
  return q;
}

export type HeroState = 'no_income' | 'over_budget' | 'over_today' | 'at_risk' | 'on_track' | 'super_saver';

/** Spec §6 order: no_income → over_budget → over today → at_risk → on_track / super_saver. */
export function heroState(d: DailySpendResponse): HeroState {
  if (d.status === 'no_income' || d.status === 'over_budget') return d.status;
  if (d.today?.left != null && d.today.left < 0) return 'over_today';
  return d.status;
}

export const STATE_META: Record<HeroState, { chip: string; title: string; variant: ChipVariant; icon: LucideIcon | null }> = {
  super_saver: { chip: 'Ahead', title: "You're ahead of plan", variant: 'success', icon: Sparkles },
  on_track: { chip: 'On track', title: 'Right on plan', variant: 'success', icon: CircleCheck },
  at_risk: { chip: 'At risk', title: 'Ease off a little', variant: 'warning', icon: TriangleAlert },
  over_today: { chip: 'Over today', title: 'Over today', variant: 'warning', icon: TrendingUp },
  over_budget: { chip: 'Over plan', title: 'Over your plan', variant: 'warning', icon: CircleAlert },
  no_income: { chip: '', title: 'Set your income', variant: 'secondary', icon: null },
};

/** Chip + title, preferring server copy when the state is the server's own status. */
export function stateCopy(d: DailySpendResponse) {
  const s = heroState(d);
  const meta = STATE_META[s];
  const server = s === d.status && s !== 'over_budget';
  return {
    state: s,
    ...meta,
    chip: (server && d.copy.chip) || meta.chip,
    title: (server && d.copy.title) || meta.title,
  };
}

/** Consecutive days before today with spent ≤ allowance, walking back from yesterday. */
export function streak(days: DailySpendDay[]): number {
  const t = days.findIndex((d) => d.isToday);
  let n = 0;
  for (let i = (t === -1 ? days.length : t) - 1; i >= 0; i--) {
    const d = days[i];
    if (d.allowance === null || d.spent > d.allowance) break;
    n++;
  }
  return n;
}

export const isLastDay = (d: DailySpendResponse) => d.today?.daysRemaining === 1;

export const monthName = (m: string) => parseDay(`${m}-01`).toLocaleDateString('en-US', { month: 'long' });
export const dayTitle = (date: string) =>
  parseDay(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
export const $ = (n: number) => money(n, true);

/** Bills held back from the flexible budget: max(expected, paid). */
export const billsReserved = (d: DailySpendResponse) => Math.max(d.plan.billsExpected, d.plan.billsPaid);

/** Start-of-today allowance for a different savings target (spec §5.6). */
export function allowanceFor(d: DailySpendResponse, target: number): number | null {
  if (!d.today || d.status === 'no_income') return null;
  const flexible = d.plan.income - target - billsReserved(d);
  const spentBeforeToday = d.totals.flexibleSpent - d.today.spent;
  return Math.max(0, Math.floor((flexible - spentBeforeToday) / d.today.daysRemaining));
}
