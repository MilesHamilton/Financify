import { vi, describe, it, expect } from "vitest";

vi.mock("server-only", () => ({}));

import {
  daysRemainingInMonth,
  computeBudgetStatusV2,
  type BudgetComputeInputV2,
} from "@/domain/metrics";

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
// computeBudgetStatusV2
// TR §2.1–2.3 formulas; FRD §4 worked examples (AC-1/AC-2/AC-3) + §5 edge cases
// ---------------------------------------------------------------------------

/**
 * Base input taken verbatim from FRD §4 AC-1/AC-2/AC-3 worked examples.
 *   AC-1: budgetedTotal=2596, flexibleSpentThisMonth=1291, daysRemaining=16
 *   AC-2: billsTotal=2500, billsPaidThisMonth=2350
 *   AC-3: estimatedIncome=5200, savingsTarget=1500, past30dAvgFlexiblePerDay=42
 */
const acBase: BudgetComputeInputV2 = {
  budgetedTotal: 2596,
  flexibleSpentThisMonth: 1291,
  daysRemaining: 16,
  billsTotal: 2500,
  billsPaidThisMonth: 2350,
  estimatedIncome: 5200,
  earnedThisMonth: 0,
  savingsTarget: 1500,
  past30dAvgFlexiblePerDay: 42,
  usingOverride: false,
};

describe("computeBudgetStatusV2", () => {
  // -------------------------------------------------------------------------
  // (a) Worked examples AC-1/AC-2/AC-3
  // -------------------------------------------------------------------------

  describe("AC-1 — spending card", () => {
    it("leftToSpend = budgetedTotal − flexibleSpentThisMonth (2596 − 1291 = 1305)", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.leftToSpend).toBe(1305);
    });

    it("safeToSpendPerDay = leftToSpend / daysRemaining (1305 / 16 ≈ 81.5625)", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.safeToSpendPerDay).toBeCloseTo(81.5625, 4);
    });

    it("spendPct = flexibleSpentThisMonth / budgetedTotal (1291 / 2596 ≈ 0.497)", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.spendPct).toBeCloseTo(1291 / 2596, 5);
    });
  });

  describe("AC-2 — bills card", () => {
    it("billsLeftToPay = MAX(0, billsTotal − billsPaidThisMonth) = 150", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.billsLeftToPay).toBe(150);
    });

    it("billsPct = billsPaidThisMonth / billsTotal (2350 / 2500 = 0.94)", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.billsPct).toBeCloseTo(0.94, 5);
    });
  });

  describe("AC-3 — savings projection", () => {
    it("projectedFlexibleSpend = flexibleSpentThisMonth + (avg × daysRemaining) = 1963", () => {
      const result = computeBudgetStatusV2(acBase);
      // 1291 + (42 × 16) = 1291 + 672 = 1963
      expect(result.projectedFlexibleSpend).toBe(1963);
    });

    it("projectedTotalSpend = billsTotal + projectedFlexibleSpend = 4463", () => {
      const result = computeBudgetStatusV2(acBase);
      // 2500 + 1963 = 4463
      expect(result.projectedTotalSpend).toBe(4463);
    });

    it("projectedSavings = estimatedIncome − projectedTotalSpend = 737", () => {
      const result = computeBudgetStatusV2(acBase);
      // 5200 − 4463 = 737
      expect(result.projectedSavings).toBe(737);
    });

    it("savingsStatus = 'at_risk' when projectedSavings (737) < savingsTarget (1500)", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.savingsStatus).toBe("at_risk");
    });

    it("advicePerDay = (income − savingsTarget − flexibleSpent − billsLeftToPay) / days ≈ 141.1875", () => {
      const result = computeBudgetStatusV2(acBase);
      // (5200 − 1500 − 1291 − 150) / 16 = 2259 / 16 = 141.1875
      expect(result.advicePerDay).toBeCloseTo(141.1875, 4);
    });

    it("noBudgets = false when budgetedTotal > 0", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.noBudgets).toBe(false);
    });

    it("noIncomeData = false when estimatedIncome > 0", () => {
      const result = computeBudgetStatusV2(acBase);
      expect(result.noIncomeData).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // (b) noBudgets fallback — budgetedTotal = 0 → v1 formula for leftToSpend
  // -------------------------------------------------------------------------

  describe("noBudgets fallback (budgetedTotal = 0)", () => {
    const input: BudgetComputeInputV2 = {
      budgetedTotal: 0,
      flexibleSpentThisMonth: 500,
      daysRemaining: 10,
      billsTotal: 200,
      billsPaidThisMonth: 100,
      estimatedIncome: 5000,
      earnedThisMonth: 0,
      savingsTarget: 1000,
      past30dAvgFlexiblePerDay: 30,
      usingOverride: false,
    };

    it("sets noBudgets = true", () => {
      const result = computeBudgetStatusV2(input);
      expect(result.noBudgets).toBe(true);
    });

    it("leftToSpend = estimatedIncome − savingsTarget − flexibleSpentThisMonth", () => {
      const result = computeBudgetStatusV2(input);
      // 5000 − 1000 − 500 = 3500
      expect(result.leftToSpend).toBe(3500);
    });

    it("spendPct = 0 when budgetedTotal = 0", () => {
      const result = computeBudgetStatusV2(input);
      expect(result.spendPct).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // (c) Negative leftToSpend — over budget (not capped, product decision 1B)
  // -------------------------------------------------------------------------

  describe("over budget — negative leftToSpend (not capped)", () => {
    const input: BudgetComputeInputV2 = {
      budgetedTotal: 1000,
      flexibleSpentThisMonth: 1500,
      daysRemaining: 10,
      billsTotal: 200,
      billsPaidThisMonth: 100,
      estimatedIncome: 5000,
      earnedThisMonth: 0,
      savingsTarget: 1000,
      past30dAvgFlexiblePerDay: 30,
      usingOverride: false,
    };

    it("leftToSpend is negative and not clamped to 0", () => {
      const result = computeBudgetStatusV2(input);
      // 1000 − 1500 = −500
      expect(result.leftToSpend).toBe(-500);
      expect(result.leftToSpend).toBeLessThan(0);
    });

    it("safeToSpendPerDay is negative (leftToSpend / daysRemaining)", () => {
      const result = computeBudgetStatusV2(input);
      // −500 / 10 = −50
      expect(result.safeToSpendPerDay).toBe(-50);
      expect(result.safeToSpendPerDay).toBeLessThan(0);
    });

    it("spendPct is capped at 1.0 when spent > budgeted", () => {
      const result = computeBudgetStatusV2(input);
      expect(result.spendPct).toBe(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // (d) billsLeftToPay clamped to 0 when billsPaidThisMonth > billsTotal
  // -------------------------------------------------------------------------

  describe("bills overpaid — billsLeftToPay clamped to 0", () => {
    const input: BudgetComputeInputV2 = {
      budgetedTotal: 2000,
      flexibleSpentThisMonth: 500,
      daysRemaining: 10,
      billsTotal: 500,
      billsPaidThisMonth: 600,
      estimatedIncome: 5000,
      earnedThisMonth: 0,
      savingsTarget: 1000,
      past30dAvgFlexiblePerDay: 30,
      usingOverride: false,
    };

    it("billsLeftToPay = 0 (not negative) when billsPaidThisMonth > billsTotal", () => {
      const result = computeBudgetStatusV2(input);
      // MAX(0, 500 − 600) = MAX(0, −100) = 0
      expect(result.billsLeftToPay).toBe(0);
    });

    it("billsPct is capped at 1.0 when paid > total", () => {
      const result = computeBudgetStatusV2(input);
      // MIN(600/500, 1.0) = MIN(1.2, 1.0) = 1.0
      expect(result.billsPct).toBe(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // (e) projectedSavings < 0 → savingsBarPct clamped to 0, status "at_risk"
  // -------------------------------------------------------------------------

  describe("projectedSavings < 0", () => {
    const input: BudgetComputeInputV2 = {
      budgetedTotal: 2000,
      flexibleSpentThisMonth: 500,
      daysRemaining: 10,
      billsTotal: 2000,
      billsPaidThisMonth: 0,
      estimatedIncome: 2000,
      earnedThisMonth: 0,
      savingsTarget: 500,
      past30dAvgFlexiblePerDay: 100,
      usingOverride: false,
    };
    // projectedFlexibleSpend = 500 + (100 × 10) = 1500
    // projectedTotalSpend = 2000 + 1500 = 3500
    // projectedSavings = 2000 − 3500 = −1500

    it("projectedSavings is negative", () => {
      const result = computeBudgetStatusV2(input);
      expect(result.projectedSavings).toBeLessThan(0);
    });

    it("savingsBarPct = 0 when projectedSavings < 0 (clamped at bottom)", () => {
      const result = computeBudgetStatusV2(input);
      // CLAMP(−1500/500, 0, 1) = CLAMP(−3, 0, 1) = 0
      expect(result.savingsBarPct).toBe(0);
    });

    it("savingsStatus = 'at_risk' when projectedSavings < 0", () => {
      const result = computeBudgetStatusV2(input);
      expect(result.savingsStatus).toBe("at_risk");
    });
  });

  // -------------------------------------------------------------------------
  // (f) noIncomeData flag
  // -------------------------------------------------------------------------

  describe("noIncomeData flag", () => {
    it("noIncomeData = true when estimatedIncome = 0 and usingOverride = false", () => {
      const result = computeBudgetStatusV2({
        budgetedTotal: 1000,
        flexibleSpentThisMonth: 200,
        daysRemaining: 10,
        billsTotal: 100,
        billsPaidThisMonth: 50,
        estimatedIncome: 0,
        earnedThisMonth: 0,
        savingsTarget: 500,
        past30dAvgFlexiblePerDay: 20,
        usingOverride: false,
      });
      expect(result.noIncomeData).toBe(true);
    });

    it("noIncomeData = false when estimatedIncome = 0 but usingOverride = true", () => {
      const result = computeBudgetStatusV2({
        budgetedTotal: 1000,
        flexibleSpentThisMonth: 200,
        daysRemaining: 10,
        billsTotal: 100,
        billsPaidThisMonth: 50,
        estimatedIncome: 0,
        earnedThisMonth: 0,
        savingsTarget: 500,
        past30dAvgFlexiblePerDay: 20,
        usingOverride: true,
      });
      expect(result.noIncomeData).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // (g) savingsStatus boundary — on_track (>=) vs at_risk (<)
  // -------------------------------------------------------------------------

  describe("savingsStatus boundary", () => {
    it("savingsStatus = 'on_track' when projectedSavings exactly equals savingsTarget", () => {
      // projectedFlexibleSpend = 1000 + (100 × 20) = 3000
      // projectedTotalSpend = 1000 + 3000 = 4000
      // projectedSavings = 5000 − 4000 = 1000 = savingsTarget → on_track (>=)
      const result = computeBudgetStatusV2({
        budgetedTotal: 3000,
        flexibleSpentThisMonth: 1000,
        daysRemaining: 20,
        billsTotal: 1000,
        billsPaidThisMonth: 0,
        estimatedIncome: 5000,
        earnedThisMonth: 0,
        savingsTarget: 1000,
        past30dAvgFlexiblePerDay: 100,
        usingOverride: false,
      });
      expect(result.projectedSavings).toBe(1000);
      expect(result.savingsStatus).toBe("on_track");
    });

    it("savingsStatus = 'at_risk' when projectedSavings is just below savingsTarget", () => {
      // projectedFlexibleSpend = 1000 + (100 × 20) = 3000
      // projectedTotalSpend = 1000 + 3000 = 4000
      // projectedSavings = 4999 − 4000 = 999 < 1000 → at_risk
      const result = computeBudgetStatusV2({
        budgetedTotal: 3000,
        flexibleSpentThisMonth: 1000,
        daysRemaining: 20,
        billsTotal: 1000,
        billsPaidThisMonth: 0,
        estimatedIncome: 4999,
        earnedThisMonth: 0,
        savingsTarget: 1000,
        past30dAvgFlexiblePerDay: 100,
        usingOverride: false,
      });
      expect(result.projectedSavings).toBe(999);
      expect(result.savingsStatus).toBe("at_risk");
    });
  });

  // -------------------------------------------------------------------------
  // billsPct = 1.0 when billsTotal = 0 (no active bill streams)
  // -------------------------------------------------------------------------

  describe("billsPct = 1.0 when billsTotal = 0", () => {
    it("billsPct defaults to 1.0 when there are no bill streams", () => {
      const result = computeBudgetStatusV2({
        budgetedTotal: 2000,
        flexibleSpentThisMonth: 500,
        daysRemaining: 15,
        billsTotal: 0,
        billsPaidThisMonth: 0,
        estimatedIncome: 5000,
        earnedThisMonth: 0,
        savingsTarget: 1000,
        past30dAvgFlexiblePerDay: 40,
        usingOverride: false,
      });
      expect(result.billsPct).toBe(1.0);
      expect(result.billsLeftToPay).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // daysRemaining = 1 (last day of month) — divides correctly, no div-by-zero
  // -------------------------------------------------------------------------

  describe("daysRemaining = 1 (last day of month)", () => {
    it("safeToSpendPerDay and advicePerDay compute correctly on final day", () => {
      // leftToSpend = 500 − 400 = 100
      // safeToSpendPerDay = 100 / 1 = 100
      // billsLeftToPay = MAX(0, 200 − 100) = 100
      // advicePerDay = (2000 − 300 − 400 − 100) / 1 = 1200
      const result = computeBudgetStatusV2({
        budgetedTotal: 500,
        flexibleSpentThisMonth: 400,
        daysRemaining: 1,
        billsTotal: 200,
        billsPaidThisMonth: 100,
        estimatedIncome: 2000,
        earnedThisMonth: 0,
        savingsTarget: 300,
        past30dAvgFlexiblePerDay: 50,
        usingOverride: false,
      });
      expect(result.leftToSpend).toBe(100);
      expect(result.safeToSpendPerDay).toBe(100);
      expect(result.advicePerDay).toBe(1200);
    });
  });
});
