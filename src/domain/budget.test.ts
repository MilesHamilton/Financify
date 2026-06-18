import { vi, describe, it, expect } from "vitest";

vi.mock("server-only", () => ({}));

import { daysRemainingInMonth, computeBudgetStatus } from "@/domain/metrics";

// ---------------------------------------------------------------------------
// daysRemainingInMonth
// ---------------------------------------------------------------------------

describe("daysRemainingInMonth", () => {
  it("mid-month: 2026-06-10 → 21 days remaining", () => {
    expect(daysRemainingInMonth("2026-06", "2026-06-10")).toBe(21);
  });

  it("last day: 2026-06-30 → 1 (floored at 1)", () => {
    expect(daysRemainingInMonth("2026-06", "2026-06-30")).toBe(1);
  });

  it("first day: 2026-06-01 → 30", () => {
    expect(daysRemainingInMonth("2026-06", "2026-06-01")).toBe(30);
  });

  it("DST spring month: 2026-03-15 → 17", () => {
    expect(daysRemainingInMonth("2026-03", "2026-03-15")).toBe(17);
  });

  it("DST fall month last day: 2026-11-30 → 1", () => {
    expect(daysRemainingInMonth("2026-11", "2026-11-30")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeBudgetStatus
// ---------------------------------------------------------------------------

describe("computeBudgetStatus", () => {
  it("on_track: healthy budget with run-rate below safe threshold", () => {
    const result = computeBudgetStatus({
      monthlyIncome: 5000,
      savingsTarget: 1000,
      spentThisMonth: 1000,
      daysRemaining: 10,
      past30dAvgPerDay: 100,
      usingOverride: false,
    });
    expect(result.monthlySpendable).toBe(4000);
    expect(result.leftToSpend).toBe(3000);
    expect(result.safeToSpendPerDay).toBe(300);
    expect(result.status).toBe("on_track");
  });

  it("at_risk via run-rate: past30dAvgPerDay exceeds safeToSpendPerDay", () => {
    const result = computeBudgetStatus({
      monthlyIncome: 5000,
      savingsTarget: 1000,
      spentThisMonth: 1000,
      daysRemaining: 10,
      past30dAvgPerDay: 400,
      usingOverride: false,
    });
    expect(result.safeToSpendPerDay).toBe(300);
    expect(result.status).toBe("at_risk");
  });

  it("at_risk via overspend: safeToSpendPerDay is NEGATIVE (not capped)", () => {
    const result = computeBudgetStatus({
      monthlyIncome: 2000,
      savingsTarget: 1000,
      spentThisMonth: 1500,
      daysRemaining: 10,
      past30dAvgPerDay: 0,
      usingOverride: false,
    });
    expect(result.leftToSpend).toBe(-500);
    expect(result.safeToSpendPerDay).toBe(-50);
    expect(result.safeToSpendPerDay).toBeLessThan(0);
    expect(result.status).toBe("at_risk");
  });

  it("at_risk when savingsTarget exceeds income: spendable is negative", () => {
    const result = computeBudgetStatus({
      monthlyIncome: 1000,
      savingsTarget: 1500,
      spentThisMonth: 0,
      daysRemaining: 10,
      past30dAvgPerDay: 0,
      usingOverride: false,
    });
    expect(result.monthlySpendable).toBe(-500);
    expect(result.status).toBe("at_risk");
  });

  it("at_risk when leftToSpend is exactly 0 (boundary: 0 <= 0)", () => {
    const result = computeBudgetStatus({
      monthlyIncome: 2000,
      savingsTarget: 0,
      spentThisMonth: 2000,
      daysRemaining: 10,
      past30dAvgPerDay: 0,
      usingOverride: false,
    });
    expect(result.leftToSpend).toBe(0);
    expect(result.status).toBe("at_risk");
  });

  it("noIncomeData is true when monthlyIncome=0 and usingOverride=false", () => {
    const result = computeBudgetStatus({
      monthlyIncome: 0,
      savingsTarget: 0,
      spentThisMonth: 0,
      daysRemaining: 10,
      past30dAvgPerDay: 0,
      usingOverride: false,
    });
    expect(result.noIncomeData).toBe(true);
  });

  it("noIncomeData is false when monthlyIncome=0 but usingOverride=true", () => {
    const result = computeBudgetStatus({
      monthlyIncome: 0,
      savingsTarget: 0,
      spentThisMonth: 0,
      daysRemaining: 10,
      past30dAvgPerDay: 0,
      usingOverride: true,
    });
    expect(result.noIncomeData).toBe(false);
  });
});
