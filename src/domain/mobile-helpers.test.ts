import { describe, it, expect } from "vitest";
import {
  monthBounds,
  priorMonthOf,
  addDays,
  addMonths,
  cumulativeFromDailyTotals,
  daysArrayForMonth,
  resolveStopDay,
  buildDailySpend,
  spendPriorToDate,
  mapAccountGroup,
  classifyStreamKind,
  buildNetWorthHistory,
} from "@/domain/mobile-helpers";

describe("monthBounds / priorMonthOf", () => {
  it("mid-year month", () => {
    expect(monthBounds("2026-06")).toEqual({ start: "2026-06-01", end: "2026-07-01" });
  });
  it("December rolls into next year", () => {
    expect(monthBounds("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
  it("priorMonthOf rolls back across a year boundary", () => {
    expect(priorMonthOf("2026-01")).toBe("2025-12");
    expect(priorMonthOf("2026-06")).toBe("2026-05");
  });
});

describe("addDays / addMonths", () => {
  it("addDays crosses a month boundary", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
  });
  it("addMonths subtracts months across a year boundary", () => {
    expect(addMonths("2026-02-15", -3)).toBe("2025-11-15");
  });
});

describe("cumulativeFromDailyTotals", () => {
  it("accumulates running totals", () => {
    expect(cumulativeFromDailyTotals([10, 0, 5, 20])).toEqual([10, 10, 15, 35]);
  });
  it("empty input → empty output", () => {
    expect(cumulativeFromDailyTotals([])).toEqual([]);
  });
});

describe("daysArrayForMonth", () => {
  it("zero-fills a 30-day month from a sparse map", () => {
    const totals = new Map([["2026-04-01", 100], ["2026-04-15", 50]]);
    const arr = daysArrayForMonth("2026-04", totals);
    expect(arr).toHaveLength(30);
    expect(arr[0]).toBe(100);
    expect(arr[14]).toBe(50);
    expect(arr[1]).toBe(0);
  });
});

describe("resolveStopDay", () => {
  it("stops at today's day-of-month for the current month", () => {
    expect(resolveStopDay("2026-06", "2026-06-10")).toBe(10);
  });
  it("returns the full month length for a past month", () => {
    expect(resolveStopDay("2026-05", "2026-06-10")).toBe(31);
  });
});

describe("buildDailySpend / spendPriorToDate", () => {
  it("current stops at stopDay; prior covers the full prior month", () => {
    const totals = new Map([
      ["2026-06-01", 10],
      ["2026-06-02", 10],
      ["2026-05-01", 5],
      ["2026-05-31", 5],
    ]);
    const daily = buildDailySpend(totals, "2026-06", "2026-05", 2);
    expect(daily.current).toEqual([10, 20]);
    expect(daily.prior).toHaveLength(31);
    expect(daily.prior[0]).toBe(5);
    expect(daily.prior[30]).toBe(10); // 5 (day1) + 5 (day31) cumulative
  });

  it("spendPriorToDate reads the prior cumulative at the same day index", () => {
    const prior = cumulativeFromDailyTotals([5, 0, 0, 0, 5]);
    expect(spendPriorToDate(prior, 2)).toBe(5);
    expect(spendPriorToDate(prior, 5)).toBe(10);
  });

  it("spendPriorToDate clamps to the last entry when stopDay exceeds prior length", () => {
    const prior = cumulativeFromDailyTotals([5, 5]);
    expect(spendPriorToDate(prior, 31)).toBe(10);
  });

  it("spendPriorToDate returns 0 for an empty prior series", () => {
    expect(spendPriorToDate([], 10)).toBe(0);
  });
});

describe("mapAccountGroup", () => {
  it("depository + savings subtype → savings", () => {
    expect(mapAccountGroup("depository", "savings")).toBe("savings");
  });
  it("depository + anything else → checking", () => {
    expect(mapAccountGroup("depository", "money market")).toBe("checking");
    expect(mapAccountGroup("depository", null)).toBe("checking");
  });
  it("credit / loan / investment map directly", () => {
    expect(mapAccountGroup("credit", "credit card")).toBe("credit");
    expect(mapAccountGroup("loan", "mortgage")).toBe("loan");
    expect(mapAccountGroup("investment", "401k")).toBe("investment");
  });
  it("unknown type → other", () => {
    expect(mapAccountGroup("brokerage", null)).toBe("other");
  });
});

describe("classifyStreamKind", () => {
  it("inactive wins regardless of direction", () => {
    expect(
      classifyStreamKind({ isActive: false, averageAmount: -500, category: null }),
    ).toBe("inactive");
  });
  it("inflow is income", () => {
    expect(
      classifyStreamKind({ isActive: true, averageAmount: -2000, category: null }),
    ).toBe("income");
  });
  it("LOAN_PAYMENTS outflow is credit_card", () => {
    expect(
      classifyStreamKind({ isActive: true, averageAmount: 200, category: "LOAN_PAYMENTS" }),
    ).toBe("credit_card");
  });
  it("ENTERTAINMENT outflow is subscription", () => {
    expect(
      classifyStreamKind({ isActive: true, averageAmount: 15, category: "ENTERTAINMENT" }),
    ).toBe("subscription");
  });
  it("everything else outflow is bill", () => {
    expect(
      classifyStreamKind({ isActive: true, averageAmount: 150, category: "RENT_AND_UTILITIES" }),
    ).toBe("bill");
  });
});

describe("buildNetWorthHistory", () => {
  const rows = [
    { accountId: "chk", type: "depository", asOfDate: "2026-06-01", balance: 1000 },
    { accountId: "chk", type: "depository", asOfDate: "2026-06-03", balance: 1200 },
    { accountId: "cc", type: "credit", asOfDate: "2026-06-02", balance: 300 },
  ];

  it("forward-fills missing days per account", () => {
    const history = buildNetWorthHistory(rows, ["2026-06-01", "2026-06-02", "2026-06-03"]);
    expect(history).toEqual([
      { date: "2026-06-01", assets: 1000, debts: 0, netWorth: 1000 },
      { date: "2026-06-02", assets: 1000, debts: 300, netWorth: 700 },
      { date: "2026-06-03", assets: 1200, debts: 300, netWorth: 900 },
    ]);
  });

  it("excludes accounts with no known balance yet as of a date", () => {
    const history = buildNetWorthHistory(rows, ["2026-05-31"]);
    expect(history).toEqual([{ date: "2026-05-31", assets: 0, debts: 0, netWorth: 0 }]);
  });

  it("other account types are excluded from assets/debts", () => {
    const withOther = [
      ...rows,
      { accountId: "other1", type: "other", asOfDate: "2026-06-01", balance: 999 },
    ];
    const history = buildNetWorthHistory(withOther, ["2026-06-01"]);
    expect(history[0]).toEqual({ date: "2026-06-01", assets: 1000, debts: 0, netWorth: 1000 });
  });
});
