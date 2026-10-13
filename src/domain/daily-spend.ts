/**
 * src/domain/daily-spend.ts
 *
 * Pure, DB-free math for GET /api/mobile/daily-spend — daily allowance vs the
 * monthly savings target. Formula and rationale: docs/rocket-clone/rm-daily-spend.md §4.
 *
 *   R = max(billsExpected, billsPaid)          unpaid bills stay reserved
 *   F = income − savingsTarget − R             flexible budget for the month
 *   allowance(d) = max(0, floor((F − C(d−1)) / (D − d + 1)))
 *
 * where C(d) is cumulative flexible spend through day d. The allowance is a
 * start-of-day snapshot: today's spend moves tomorrow's number, not today's.
 */

import type {
  DailySpendDay,
  DailySpendResponse,
  DailySpendStatus,
  DailySpendToday,
} from "@/contracts/mobile-api";

export interface DailySpendInput {
  /** "YYYY-MM"; must not be after todayNY's month. */
  month: string;
  /** "YYYY-MM-DD" in America/New_York. */
  todayNY: string;
  income: number;
  usingIncomeOverride: boolean;
  savingsTarget: number;
  /** Monthly-normalised expected bills. */
  billsExpected: number;
  billsPaid: number;
  /** Flexible spend by Plaid calendar date ("YYYY-MM-DD"). */
  dailyFlexible: Map<string, number>;
  /** Trailing-30-day flexible spend ÷ 30. */
  averagePerDay: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const usd = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;

export function computeDailySpend(i: DailySpendInput): DailySpendResponse {
  const { month, todayNY } = i;
  const [y, m] = month.split("-").map(Number);
  const D = new Date(y, m, 0).getDate();
  const isCurrentMonth = todayNY.slice(0, 7) === month;
  if (!isCurrentMonth && month > todayNY) throw new Error(`future_month: ${month}`);
  const t = isCurrentMonth ? Number(todayNY.slice(8, 10)) : D;

  // f[d-1] = spend on day d; anything dated after today (Plaid skew) lands in today.
  const f = new Array<number>(D).fill(0);
  for (const [date, amount] of i.dailyFlexible) {
    if (date.slice(0, 7) !== month) continue;
    f[Math.min(Number(date.slice(8, 10)), t) - 1] += amount;
  }
  // C[d] = cumulative through day d; C[0] = 0. Frozen after today.
  const C = [0];
  for (let d = 1; d <= D; d++) C.push(r2(C[d - 1] + (d <= t ? f[d - 1] : 0)));

  const noIncome = i.income === 0 && !i.usingIncomeOverride;
  const R = Math.max(i.billsExpected, i.billsPaid);
  const F = noIncome ? null : r2(i.income - i.savingsTarget - R);
  // r2 first so float noise (99.999999) doesn't floor a whole dollar away.
  const raw = (d: number): number | null => (F === null ? null : r2((F - C[d - 1]) / (D - d + 1)));
  const allowanceAt = (d: number): number | null => {
    const v = raw(d);
    return v === null ? null : Math.max(0, Math.floor(v));
  };

  const flexibleSpent = C[t];
  const remaining = F === null ? null : r2(F - flexibleSpent);
  const projectedSavings = noIncome
    ? null
    : r2(i.income - R - flexibleSpent - i.averagePerDay * (D - t));
  const percentOfTarget =
    projectedSavings !== null && i.savingsTarget > 0
      ? Math.round((projectedSavings / i.savingsTarget) * 100)
      : null;

  let status: DailySpendStatus;
  if (noIncome) status = "no_income";
  else if (remaining! < 0) status = "over_budget";
  else if (percentOfTarget !== null)
    status = percentOfTarget >= 105 ? "super_saver" : percentOfTarget >= 99 ? "on_track" : "at_risk";
  else status = projectedSavings! >= 0 ? "on_track" : "at_risk";

  let today: DailySpendToday | null = null;
  if (isCurrentMonth) {
    const allowance = allowanceAt(t);
    const spent = r2(f[t - 1]);
    today = {
      date: todayNY,
      daysRemaining: D - t + 1,
      allowance,
      allowanceRaw: raw(t),
      spent,
      left: allowance === null ? null : r2(allowance - spent),
      tomorrowAllowance: t < D ? allowanceAt(t + 1) : null,
      overBy: remaining !== null && remaining < 0 ? -remaining : 0,
    };
  }

  const futureAllowance = t < D ? allowanceAt(t + 1) : null;
  const days: DailySpendDay[] = [];
  for (let d = 1; d <= D; d++) {
    const isFuture = d > t;
    days.push({
      date: `${month}-${String(d).padStart(2, "0")}`,
      day: d,
      spent: isFuture ? 0 : r2(f[d - 1]),
      allowance: isFuture ? futureAllowance : allowanceAt(d),
      cumulative: isFuture ? null : C[d],
      pace: F === null ? null : r2((F * d) / D),
      isToday: isCurrentMonth && d === t,
      isFuture,
    });
  }

  return {
    month,
    isCurrentMonth,
    daysInMonth: D,
    plan: {
      income: r2(i.income),
      usingIncomeOverride: i.usingIncomeOverride,
      savingsTarget: r2(i.savingsTarget),
      billsExpected: r2(i.billsExpected),
      billsPaid: r2(i.billsPaid),
      billsLeftToPay: r2(Math.max(0, i.billsExpected - i.billsPaid)),
      flexibleBudget: F,
      isFeasible: F === null || F >= 0,
    },
    totals: {
      flexibleSpent,
      remaining,
      averagePerDay: r2(i.averagePerDay),
      projectedSavings,
      percentOfTarget,
    },
    status,
    copy: isCurrentMonth
      ? currentCopy(status, today!.allowance ?? 0, t === D)
      : pastCopy(status, flexibleSpent, F),
    today,
    days,
  };
}

function currentCopy(
  status: DailySpendStatus,
  allowance: number,
  isLastDay: boolean,
): DailySpendResponse["copy"] {
  const x = `${usd(allowance)} ${isLastDay ? "for today" : "a day"}`;
  switch (status) {
    case "super_saver":
      return { chip: "Ahead", title: "You're ahead of plan", body: `Keep it under ${x} and you'll beat your savings goal.` };
    case "on_track":
      return { chip: "On track", title: "Right on plan", body: `Spend less than ${x} to hit your savings goal.` };
    case "at_risk":
      return { chip: "At risk", title: "Ease off a little", body: `Drop to ${x} for the rest of the month to still hit your goal.` };
    case "over_budget":
      return { chip: "Over", title: "Over your plan", body: "You've used this month's spending money; new spend comes out of savings." };
    case "no_income":
      return { chip: "—", title: "Set your income", body: "Add your monthly income in Settings to see a daily allowance." };
  }
}

/** Past months: RM's past-month verdict thresholds on % of the flexible budget spent. */
function pastCopy(
  status: DailySpendStatus,
  spent: number,
  F: number | null,
): DailySpendResponse["copy"] {
  if (F === null) return currentCopy(status, 0, false);
  const pct = F > 0 ? (spent / F) * 100 : spent > 0 ? Infinity : 0;
  const verdict =
    pct <= 98.9 ? "Under budget" : pct <= 101 ? "Right on budget" : pct <= 109.9 ? "Slightly over plan" : "Over budget";
  return { chip: verdict, title: verdict, body: `You spent ${usd(spent)} of your ${usd(Math.max(F, 0))} spending plan.` };
}
