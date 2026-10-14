import { describe, it, expect } from "vitest";
import { buildRecap, type RecapInput } from "@/domain/recap";

const cat = (id: string, spent: number) => ({ id, label: id, color: "#000", icon: "Circle", group: "expense", spent });

// September 2026: 30 days, starts on a Tuesday.
const base = (over: Partial<RecapInput> = {}): RecapInput => ({
  month: "2026-09",
  income: 5000,
  totalSpent: 4000,
  priorTotalSpent: 5000,
  fixedSpent: 2000,
  savingsTarget: 1500,
  transactionCount: 40,
  categories: [cat("a", 300), cat("b", 1000), cat("c", 500), cat("d", 200)],
  merchants: [
    { name: "Big", logoUrl: null, spent: 600, count: 2 },
    { name: "Cafe", logoUrl: null, spent: 90, count: 9 },
  ],
  biggestPurchase: null,
  dailyLifestyle: new Map([
    ["2026-09-05", 300], // Saturday
    ["2026-09-12", 200], // Saturday
    ["2026-09-07", 400], // Monday
  ]),
  daysUnderAllowance: 20,
  ...over,
});

describe("buildRecap", () => {
  it("derives totals, change and savings rate", () => {
    const r = buildRecap(base());
    expect(r.daysInMonth).toBe(30);
    expect(r.lifestyleSpent).toBe(2000);
    expect(r.changePct).toBe(-20);
    expect(r.saved).toBe(1000);
    expect(r.savingsRatePct).toBe(20);
  });

  it("ranks top 3 categories numerically with shares of lifestyle spend", () => {
    const r = buildRecap(base());
    expect(r.topCategories.map((c) => [c.id, c.sharePct])).toEqual([["b", 50], ["c", 25], ["a", 15]]);
  });

  it("separates top merchant from most visited", () => {
    const r = buildRecap(base());
    expect(r.topMerchant?.name).toBe("Big");
    expect(r.mostVisited?.name).toBe("Cafe");
  });

  it("counts no-spend days and the busiest weekday", () => {
    const r = buildRecap(base());
    expect(r.noSpendDays).toBe(27);
    expect(r.busiestWeekday).toEqual({ name: "Saturday", spent: 500 });
  });

  it("handles no prior month and no income", () => {
    const r = buildRecap(base({ priorTotalSpent: 0, income: 0 }));
    expect(r.changePct).toBeNull();
    expect(r.priorTotalSpent).toBeNull();
    expect(r.savingsRatePct).toBeNull();
  });

  it("picks the persona by priority", () => {
    expect(buildRecap(base({ income: 6000 })).persona.title).toBe("The Compounder");
    expect(buildRecap(base()).persona.title).toBe("The Steady Builder");
    expect(buildRecap(base({ income: 4100 })).persona.title).toBe("The Minimalist");
    const busy = new Map(Array.from({ length: 30 }, (_, k) => [`2026-09-${String(k + 1).padStart(2, "0")}`, 10]));
    expect(buildRecap(base({ income: 4100, dailyLifestyle: busy })).persona.title).toBe("The Regular");
    expect(buildRecap(base({ income: 3000, dailyLifestyle: busy, merchants: [] })).persona.title).toBe("The b Devotee");
  });
});
