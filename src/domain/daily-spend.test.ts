import { describe, it, expect } from "vitest";
import { computeDailySpend, type DailySpendInput } from "@/domain/daily-spend";

// October 2026: 31 days. F = 5000 − 1000 − 900 = 3100 → 100/day on plan.
const base = (over: Partial<DailySpendInput> = {}): DailySpendInput => ({
  month: "2026-10",
  todayNY: "2026-10-11",
  income: 5000,
  usingIncomeOverride: false,
  savingsTarget: 1000,
  billsExpected: 900,
  billsPaid: 0,
  dailyFlexible: new Map(),
  averagePerDay: 100,
  ...over,
});

/** `days` days of `amount` each starting on the 1st. */
const evenSpend = (days: number, amount: number): Map<string, number> =>
  new Map(Array.from({ length: days }, (_, k) => [`2026-10-${String(k + 1).padStart(2, "0")}`, amount]));

describe("computeDailySpend", () => {
  it("normal month on plan: even 100/day allowance, on_track", () => {
    const r = computeDailySpend(base({ dailyFlexible: evenSpend(10, 100) }));
    expect(r.plan.flexibleBudget).toBe(3100);
    expect(r.totals.flexibleSpent).toBe(1000);
    expect(r.today).toMatchObject({ daysRemaining: 21, allowance: 100, spent: 0, left: 100, tomorrowAllowance: 105 });
    // 5000 − 900 − 1000 − 100×20 = 1100 → 110 % of target
    expect(r.totals.projectedSavings).toBe(1100);
    expect(r.totals.percentOfTarget).toBe(110);
    expect(r.status).toBe("super_saver");
    expect(r.days).toHaveLength(31);
    expect(r.days[9]).toMatchObject({ day: 10, spent: 100, cumulative: 1000, allowance: 100, pace: 1000 });
    expect(r.days[10].isToday).toBe(true);
    expect(r.days[11]).toMatchObject({ isFuture: true, spent: 0, cumulative: null, allowance: 105 });
    expect(r.copy.body).toContain("$100 a day");
  });

  it("overspend today lowers tomorrow but not today", () => {
    const flex = evenSpend(10, 100);
    flex.set("2026-10-11", 300);
    const r = computeDailySpend(base({ dailyFlexible: flex }));
    expect(r.today!.allowance).toBe(100);
    expect(r.today!.left).toBe(-200);
    // (3100 − 1300) / 20 = 90
    expect(r.today!.tomorrowAllowance).toBe(90);
  });

  it("past overspend lowers today's allowance, underspend raises it", () => {
    const over = computeDailySpend(base({ dailyFlexible: evenSpend(10, 142) })); // C=1420 → 1680/21 = 80
    expect(over.today!.allowance).toBe(80);
    expect(over.days[1].allowance).toBe(98); // day 2: (3100 − 142) / 30 = 98.6 → floor 98
    const under = computeDailySpend(base({ dailyFlexible: evenSpend(10, 37) })); // C=370 → 2730/21 = 130
    expect(under.today!.allowance).toBe(130);
  });

  it("no income and no override → no_income with null allowances", () => {
    const r = computeDailySpend(base({ income: 0, savingsTarget: 0, dailyFlexible: evenSpend(3, 20) }));
    expect(r.status).toBe("no_income");
    expect(r.plan.flexibleBudget).toBeNull();
    expect(r.totals.projectedSavings).toBeNull();
    expect(r.today).toMatchObject({ allowance: null, left: null, tomorrowAllowance: null, overBy: 0, spent: 0 });
    expect(r.days[2]).toMatchObject({ cumulative: 60, allowance: null, pace: null });
    expect(r.copy.title).toBe("Set your income");
  });

  it("no savings target → percentOfTarget null, status from projected sign", () => {
    const r = computeDailySpend(base({ savingsTarget: 0 }));
    expect(r.plan.flexibleBudget).toBe(4100);
    expect(r.totals.percentOfTarget).toBeNull();
    expect(r.status).toBe("on_track");
  });

  it("override set to 0 is valid and lands over_budget, infeasible", () => {
    const r = computeDailySpend(base({ income: 0, usingIncomeOverride: true }));
    expect(r.plan.flexibleBudget).toBe(-1900);
    expect(r.plan.isFeasible).toBe(false);
    expect(r.status).toBe("over_budget");
    expect(r.today!.allowance).toBe(0);
  });

  it("negative remaining → 0 allowance, overBy deficit, over_budget", () => {
    const r = computeDailySpend(base({ dailyFlexible: evenSpend(10, 320) })); // 3200 > 3100
    expect(r.totals.remaining).toBe(-100);
    expect(r.today).toMatchObject({ allowance: 0, overBy: 100, tomorrowAllowance: 0 });
    expect(r.today!.allowanceRaw).toBeLessThan(0);
    expect(r.days.every((d) => d.allowance === null || d.allowance >= 0)).toBe(true);
    expect(r.status).toBe("over_budget");
  });

  it("bills paid above expected are reserved once", () => {
    const r = computeDailySpend(base({ billsPaid: 1000 }));
    expect(r.plan.flexibleBudget).toBe(3000);
    expect(r.plan.billsLeftToPay).toBe(0);
  });

  it("first day of month: allowance = F / D", () => {
    const r = computeDailySpend(base({ todayNY: "2026-10-01" }));
    expect(r.today).toMatchObject({ daysRemaining: 31, allowance: 100, tomorrowAllowance: 103 });
    expect(r.days.filter((d) => d.isFuture)).toHaveLength(30);
  });

  it("last day of month: allowance is all of remaining, no tomorrow", () => {
    const r = computeDailySpend(base({ todayNY: "2026-10-31", dailyFlexible: evenSpend(30, 100) }));
    expect(r.today).toMatchObject({ daysRemaining: 1, allowance: 100, tomorrowAllowance: null });
    expect(r.days.some((d) => d.isFuture)).toBe(false);
    expect(r.copy.body).toContain("$100 for today");
  });

  it("timezone boundary: a txn dated after today (UTC already tomorrow) counts as today", () => {
    // 11pm NY on Oct 11 is Oct 12 UTC; Plaid may already date the txn the 12th.
    const r = computeDailySpend(base({ dailyFlexible: new Map([["2026-10-12", 40]]) }));
    expect(r.today!.spent).toBe(40);
    expect(r.days[11]).toMatchObject({ spent: 0, isFuture: true });
    expect(r.totals.flexibleSpent).toBe(40);
  });

  it("txns outside the month are ignored", () => {
    const r = computeDailySpend(base({ dailyFlexible: new Map([["2026-09-30", 500], ["2026-11-01", 500]]) }));
    expect(r.totals.flexibleSpent).toBe(0);
  });

  it("past month: no today, full history, verdict copy", () => {
    const r = computeDailySpend(base({ month: "2026-09", dailyFlexible: new Map([["2026-09-15", 3000]]) }));
    expect(r.isCurrentMonth).toBe(false);
    expect(r.today).toBeNull();
    expect(r.daysInMonth).toBe(30);
    expect(r.days.some((d) => d.isFuture)).toBe(false);
    expect(r.days[29].cumulative).toBe(3000);
    expect(r.totals.projectedSavings).toBe(1100); // no future days to project
    expect(r.copy.chip).toBe("Under budget"); // 3000 / 3100 = 96.8 %
  });

  it("future month throws", () => {
    expect(() => computeDailySpend(base({ month: "2026-11" }))).toThrow(/future_month/);
  });
});
