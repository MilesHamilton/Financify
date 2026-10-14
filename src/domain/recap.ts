/**
 * src/domain/recap.ts
 *
 * Pure (DB-free) assembly of the monthly "Wrapped"-style recap. The loader in
 * mobile-recap.ts gathers the rows; everything derived lives here so it can be
 * unit-tested.
 */

import type { Category, RecapMerchant, RecapResponse } from "@/contracts/mobile-api";

export interface RecapInput {
  month: string;
  income: number;
  totalSpent: number;
  priorTotalSpent: number;
  fixedSpent: number;
  savingsTarget: number;
  transactionCount: number;
  /** Lifestyle spend per category, any order. */
  categories: Array<Category & { spent: number }>;
  /** Lifestyle spend per merchant, any order. */
  merchants: RecapMerchant[];
  biggestPurchase: RecapResponse["biggestPurchase"];
  /** Lifestyle spend per "YYYY-MM-DD"; days with no spend may be absent. */
  dailyLifestyle: Map<string, number>;
  /** From Daily Spend; null when there's no income plan. */
  daysUnderAllowance: number | null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildRecap(i: RecapInput): RecapResponse {
  const [y, m] = i.month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lifestyleSpent = Math.max(0, i.totalSpent - i.fixedSpent);
  const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

  const topCategories = [...i.categories]
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3)
    .map((c) => ({ ...c, sharePct: lifestyleSpent > 0 ? pct(c.spent, lifestyleSpent) : 0 }));

  const bySpent = [...i.merchants].sort((a, b) => b.spent - a.spent);
  const topMerchant = bySpent[0] ?? null;
  const byVisits = [...i.merchants].sort((a, b) => b.count - a.count || b.spent - a.spent);
  const visited = byVisits[0];
  const mostVisited = visited && visited.count >= 3 && visited.name !== topMerchant?.name ? visited : null;

  const weekdayTotals = new Array<number>(7).fill(0);
  let noSpendDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${i.month}-${String(d).padStart(2, "0")}`;
    const spent = i.dailyLifestyle.get(date) ?? 0;
    if (spent <= 0) noSpendDays++;
    weekdayTotals[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] += spent;
  }
  const busiest = weekdayTotals.indexOf(Math.max(...weekdayTotals));
  const busiestWeekday = weekdayTotals[busiest] > 0 ? { name: WEEKDAYS[busiest], spent: weekdayTotals[busiest] } : null;

  const saved = i.income - i.totalSpent;
  const savingsRatePct = i.income > 0 ? pct(saved, i.income) : null;

  return {
    month: i.month,
    income: i.income,
    totalSpent: i.totalSpent,
    priorTotalSpent: i.priorTotalSpent > 0 ? i.priorTotalSpent : null,
    changePct: i.priorTotalSpent > 0 ? pct(i.totalSpent - i.priorTotalSpent, i.priorTotalSpent) : null,
    fixedSpent: i.fixedSpent,
    lifestyleSpent,
    saved,
    savingsRatePct,
    savingsTarget: i.savingsTarget,
    transactionCount: i.transactionCount,
    topCategories,
    topMerchant,
    mostVisited,
    biggestPurchase: i.biggestPurchase,
    busiestWeekday,
    noSpendDays,
    daysUnderAllowance: i.daysUnderAllowance,
    daysInMonth,
    persona: persona({ saved, savingsTarget: i.savingsTarget, savingsRatePct, noSpendDays, topCategories, mostVisited }),
  };
}

/** First matching rule wins; ordered from most to least flattering. */
export function persona(p: {
  saved: number;
  savingsTarget: number;
  savingsRatePct: number | null;
  noSpendDays: number;
  topCategories: Array<{ label: string; sharePct: number }>;
  mostVisited: RecapMerchant | null;
}): { title: string; blurb: string } {
  if (p.savingsTarget > 0 && p.saved >= p.savingsTarget)
    return { title: "The Compounder", blurb: "You beat your savings goal. Your money is feeding itself now." };
  if (p.savingsRatePct !== null && p.savingsRatePct >= 20)
    return { title: "The Steady Builder", blurb: `You kept ${p.savingsRatePct}% of what you earned. That's how wealth starts.` };
  if (p.noSpendDays >= 8)
    return { title: "The Minimalist", blurb: `${p.noSpendDays} days without spending a cent. Quiet, and effective.` };
  if (p.mostVisited && p.mostVisited.count >= 8)
    return { title: "The Regular", blurb: `${p.mostVisited.count} visits to ${p.mostVisited.name}. They probably know your order.` };
  const top = p.topCategories[0];
  if (top && top.sharePct >= 35)
    return { title: `The ${top.label} Devotee`, blurb: `${top.sharePct}% of your lifestyle spend went to ${top.label.toLowerCase()}.` };
  if (p.saved < 0)
    return { title: "The Overextender", blurb: "You spent more than you made. Next month is a fresh lap." };
  return { title: "The Balancer", blurb: "No single habit ran the show. A well-spread month." };
}
