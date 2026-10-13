# RM daily spend vs. savings target, mapped to Financify

**TL;DR.** RM has no standalone "daily spending" screen. The feature is the **Savings Target tile** (`ProjectedSavingsTargetTileContainer` → `SavingsTile`) at the top of the Budget experience (`SavingsInBudgetExperienceContainer`). It is backed by two pure functions I recovered literally from the Hermes bytecode:

- **Daily allowance:** `leftForSpendDailyAmountRaw = round(max(amountBudgeted − amountSpentThisMonth, 0) / daysRemaining)`.
- **Projected savings:** `round(targetIncome − actualSpendIncludingBills − (past30DaysSpend / 30) × daysRemaining)`.

The tile gets a state from `projectedSavings / savingsTarget`: **Super Saver** at ≥105 %, **On Track** at ≥99 %, otherwise **At Risk**. Each state has its own title, body and chip, and the body text includes the "$X/day" allowance. A second, simpler allowance chip appears on the Spending budget tile: "$X/day for Nd", or "$X for today" on the last day. Financify already computes almost all of these inputs in `computeBudgetStatusV2`. The new endpoint mainly needs a per-day series and a start-of-day allowance snapshot. The formula is in §4 and the TypeScript shape is in §5.

Confidence: **literal** means the value is a constant, string or arithmetic op read directly from the bytecode. **Inferred** means I reconstructed it from names or ordering. Each item below is tagged.

---

## 1. Where it lives (screens, components, routes)

| Thing | Bytecode name | Confidence |
|---|---|---|
| Budget screen container (hosts the tile) | `SavingsInBudgetExperienceContainer#41442`. The query `SavingsBudgetExperienceContainer` runs with `requestPolicy: 'cache-and-network'` | literal |
| Screen wrappers / routes | `BudgetScreenV2Wrapper`, `ManageBudgetRevampWithSavingsTargetScreen`, route `Home_NextGenBudgets`, modal `AppModal_Budget`. The More-menu "Budget" tab is behind the `showBudgetTab` flag | literal |
| Savings target tile | `ProjectedSavingsTargetTileContainer#41479` → `SavingsTile#41576` → `SavingsTileChart#41601` | literal |
| Tile view-model hook | `useSavingsTargetTile#41481` | literal |
| Allowance math | `getSavingsTargetLeftForSpendDailyAmount#41488` (module #5948) | literal |
| Projection math | `getSavingsTargetProjectedSavings#41484` (module #5947) | literal |
| State → copy | `getProjectedSavingsTileTitleText#41510`, `…BodyText#41519`, `…ChipLabel#41505`, `…ChipVariant#41500`, `getSavingsTargetTileValueColor#41494` | literal |
| Info modal | `SavingsTargetModalContainer` → `SavingsTargetModalBody#41599`, with `getStatusText`, `getDaysRemainingText`, `getProjectedSavingsText`, `getLeftForSpendingText`, `getThirtyDayAvgText` | literal |
| Spending budget tile + allowance chip | `MemoizedSpendingBudgetTile` → `BudgetTile#43598` → `LeftToSpendChip#43613` (label from `getCurrentMonthChipLabel#43600`). Tapping it opens `AppModal_BudgetExperienceInfoModal` | literal |
| Left-to-spend message (info modal) | `getCurrentMonthLeftToSpendMessage#52823` | literal |
| Edit target | `EditSavingsTarget`, `EditSavingsTargetGraph`, `AppModal_EditSavingsTarget`, `BudgetWorkflowSpendingSavingSliderInner` (slider with `setSavingsTargetCents`) | literal |
| Daily bars chart (weekly recap, not the budget) | `TotalSpend#54228` → `DailySpendChart#54233` (`ChartCard` titled **"Spend per day"**) | literal |
| Safe to Spend (separate, cash-flow based) | module #7363: "Safe to Spend" / "Cash after bills" toggle | literal |

Order of the tiles on the Budget screen (from the container's string operands, so **inferred**): `HeaderTimePeriodSelector` (month) → **ProjectedSavingsTargetTile** (current month) or `PastMonthSavingsTileContainer` (past months) → `MemoizedSpendingBudgetTile` → `MemoizedBillsBudgetTile` → `MemoizedEarningsBudgetTile` → `MemoizedBudgetExperienceSummaryCard` → `MemoizedCategoryBudgets` → `BudgetExperienceFAQ`. When there is no plan, `BudgetsExperienceEmptyState` shows instead.

## 2. Data inputs (literal GraphQL fragment)

```graphql
fragment SavingsTargetTileFragment on User {
  past30DaysSpend: transactionAmountSum(gteDate:$thirtyDaysAgo ltDate:$today type:spentExcludeBillsAndUtilities)
  budgetPlan(month:$selectedMonth) {
    id custom_income savings_target
    amountSpent(includeRecurring:true)
    amountBudgeted(includeRecurring:true)
    billsAndUtilitiesBudgetItem { actualAmount }
  }
}
```

Variables (literal): `selectedMonth`, `endOfSelectedMonth`, `lastMonth`, `endOfLastMonth`, `today`, `thirtyDaysAgo = today − {days: 30}`.

| RM input | Meaning | Note |
|---|---|---|
| `custom_income` → `targetIncome` | The user's planned monthly income | literal; defaults to 0 when null |
| `savings_target` | Monthly savings goal | literal; defaults to 0 |
| `amountBudgeted(includeRecurring:true)` | Spending plan including bills. Most likely income − savings target, since the slider moves spend and save against each other | field literal; **meaning inferred** |
| `amountSpent(includeRecurring:true)` → `actualSpendIncludingBills` / `amountSpentThisMonth` | All spend this month, bills included | literal |
| `past30DaysSpend` | Discretionary spend (bills excluded) in **[today − 30, today)**. Today itself is excluded | literal |

## 3. Logic recovered

### 3.1 Days remaining. RM has two different definitions.
- **Savings tile (`useSavingsTargetTile`, literal):** `daysRemainingInMonth = DateTime.now().daysInMonth − DateTime.now().day`, then `daysRemaining = daysRemainingInMonth > 0 ? daysRemainingInMonth : 1`. **Today is excluded**, and the minimum is 1. On the 13th of a 31-day month this gives 18.
- **Budget chip (`getCurrentMonthChipLabel` / `getDaysRemaining`, literal):** `floor(DateTime.now().endOf('month').diff(DateTime.local(), 'day').days)`. This is also effectively "full days after today". When it is 0 (the last day), the chip switches to "for today".

### 3.2 Daily allowance (literal, `getSavingsTargetLeftForSpendDailyAmount`)
```
leftForSpendDailyAmountRaw = Math.round(Math.max(amountBudgeted − amountSpentThisMonth, 0) / daysRemaining)
leftForSpendDailyAmount    = formatCurrency({ amount: raw, shorten: 'dollars' })   // "$42"
```
The allowance is **clamped at 0** and rounded to whole dollars. Because it is recomputed on every render from month-to-date spend, it **self-adjusts**: overspending today lowers tomorrow's number, and underspending raises it. Any surplus or deficit is spread evenly across the remaining days.

### 3.3 Budget-tile chip (literal, `getCurrentMonthChipLabel`)
```
days = floor(endOfMonth − now in days)
perDay = days === 0 ? amountRemaining : amountRemaining / days
label  = days === 0 ? `${fmt(max(perDay,0))} for today` : `${fmt(max(perDay,0))}/day for ${days}d`
```
Chip variant (literal, `getChipVariant`): `metricWarningLight` when the current month's spentPercent ≥ 100, or when a past month's ≥ 101.1. Otherwise `successLight`.

### 3.4 Projected savings (literal, `getSavingsTargetProjectedSavings`)
```
projectedSavings = Math.round(targetIncome − actualSpendIncludingBills − (past30DaysSpend / 30) × daysRemaining)
thirtyDayAvg     = past30DaysSpend / 30
```
There is also a simpler `getProjectedSavings` (literal) used by the budget editor: `custom_income − nonDiscretionarySpendBudgeted − spendingBudgeted`.

### 3.5 States (literal ts-pattern `match` cases, evaluated in this order)
`currentPercentOfTarget = savingsTarget !== 0 ? round(projectedSavings / savingsTarget × 100) : 100`

| # | Condition | State key | Chip label | Chip variant | Title |
|---|---|---|---|---|---|
| 1 | target ≥ 0, projected ≥ 0, pct ≥ 105 | `superSavings` | **Super Saver** | SUCCESS | **"You’re ahead of schedule!"** |
| 2 | target ≥ 0, projected ≥ 0, pct ≥ 99 | `onTrack` | **On Track** | SUCCESS | **"Keep doing what you're doing!"** |
| 3 | target > 0, pct < 99, projected ≥ 0 | `atRiskSpendRemaining` | **At Risk** | WARNING | **"Try to slow down your spending."** |
| 4 | target ≥ 0, pct < 99, projected < 0 | `atRiskOverSpending` | At Risk | WARNING | **"Spend Carefully!"** |
| 5 | spentMoreThanBudget (`amountSpentThisMonth > amountBudgeted`), title/body matchers only | (over) | — | — | its own body (see §3.6) |
| 6 | chip only: target ≤ 0 and projected < target → **At Risk**; target ≤ 0 and projected ≥ target → **On Track** | | | | |
| — | no match | logs "…did not match any cases." | "ERROR STATE" | | |

Analytics/user-trait names (literal): "Positive Target On Track", "Negative Target On Track", "Zero Target On Track". Value color (literal): `POSITIVE_SAVINGS` when projected > 0, otherwise `NEGATIVE_SAVINGS`.

### 3.6 User-facing copy (literal strings; `{X}` = allowance, `{N}` = days)
**Tile body** (`getProjectedSavingsTileBodyText`. The first two map literally to states 1 and 2; the mapping of the rest is **inferred** from case order):
- Super Saver: "Stay on this spending pace and your bank account will thank you! Spend less than **{X}**/day to meet your savings target."
- On Track: "Nice work! If you spend less than **{X}**/day, you will meet your savings target!"
- At Risk (spend remaining): "You can still meet your savings target by slowing your spending to **{X}**/day for the rest of the month."
- At Risk (over-spending): "You're trending over your budget, but there's still time! Slow down spending to make sure you hit your savings target."
- Spent more than budget: "You've reached your spending budget for the month, so any new spending could chip away at your savings."

**Tile chrome** (`SavingsTile`): label "Projected Savings", piggy-bank icon, "Of {target} Target", chip at top right, value in HeadingRegular, body in ParagraphRegular, and a small bar chart (`SavingsTileChart`, 150×110, padding top 5 / bottom 20 / left 50, a dashed target line, a rounded bar showing projected savings against the target).

**Info modal** (`SavingsTargetModalBody`):
- Status: "Based on your average daily spend (over the last 30 days), you are on track to stay within your budget." / "…you are at risk of going over budget." / "Be mindful of your spending for the rest of the month, as you have reached your spending budget for the month."
- Projection: "If you continue spending an average of **{avg}**/day for the next **{N}** days, your projected savings is **{projected}**." / "You are at risk of missing your savings target this month by about **{gap}** …"
- Rows: "Days Remaining" ("{N} Day(s) Left"), left-for-spending, 30-day average.

**Spending budget info modal** (`getCurrentMonthLeftToSpendMessage`):
- Normal: "There is **{remaining}** left in your spending budget and **{N}** day(s) left in the month, so you can spend an average of **{X}** a day and stay within your budget."
- At budget: "You have reached your spending budget with **{N}** day(s) left in the month, so try to stick to essentials to keep from going too far over budget."

**Chip and labels:** "{X}/day for {N}d", "{X} for today", "Left To Spend" / "Left to pay" (`getLeftForSpendHeadingText`), "Under Budget By" / "Over Budget By", " left to spend", " over", " under".

**Past-month verdicts** (`getPastMonthChipLabel`, literal thresholds on spentPercent): ≤ 98.9 → **Under Budget**, ≤ 101 → **Right on Budget**, ≤ 109.9 → **Slightly Over Plan**, > 109.9 → **Over Budget**.

**Safe to Spend** (a separate, cash-flow-based concept; literal): "Your safe to spend amount is your current checking balance minus the bills scheduled to hit your checking account before next payday. Spend less than this amount to ensure you make it to your next payday without overdrafting." Financify could add this later from balances, `nextPayday` and upcoming bills.

### 3.7 Per-day chart (literal, `buildDailySpendChartData` / `DailySpendChart`)
This chart is used in the weekly recap. Each transaction is bucketed by `DateTime.fromISO(date).weekday − 1` into 7 bars, with `xKey: 'day'`. The average line is `round(centsToDollars(round(total / 7)))`, drawn as a dashed 1 px `Line` with `DashPathEffect`. The y-axis ticks are `[0, floor(max/2), round(max)]`, or `[0,50,100]` when max < 2. Tick labels use `"$" + n.toLocaleString()`. Chart padding is `{top 10, bottom 30, right 0}`; the x-axis line is transparent with `labelOffset 10`. Bars have rounded top corners. Each bar has an accessibility label of "Mon, $12.00". The copy is: "You spent a total of {X}", "You spent an average of {X}/day, with {day} being your highest spend", and the empty state "No spending data available for this week."

**RM does not draw a month-long allowance-per-day calendar.** The daily number is a single figure in the tile body and in the chip. The per-day series in §5 is a Financify addition so we can draw cumulative-vs-pace bars.

---

## 4. Financify mapping and PROPOSED FORMULA

### 4.1 Existing pieces
| Need | Financify source |
|---|---|
| Income `I` | `getMonthlyIncomeEstimate()`: `monthly_income_override` if set (`usingOverride`), otherwise the average of the last 3 full months of income-group inflow |
| Savings target `S` | `app_settings.monthly_savings_target` (same call). Edited via `PUT /api/settings` |
| Bills expected `B` | `getBudgetStatusV2.billsTotal` = Σ `average_amount` of `recurring_streams` with `is_active AND is_bill`. ⚠ This is **not frequency-normalised**: weekly or annual streams are counted once. Normalise with the same `monthlyAmount()` the mobile recurring utils use |
| Bills paid `Bp` | `billsPaidRow`: expense txns this month that match a bill stream (`BILL_MATCH_EXISTS`) |
| Flexible spend per day `f(d)` | Same filter as `flexibleSpentThisMonth` (expense group, `amount > 0`, `NOT is_excluded`, `NOT BILL_MATCH_EXISTS`, pending **included**), grouped by `t.date` |
| 30-day average `a` | `past30dAvgFlexiblePerDay` (today − 29 … today, divided by 30) |
| Days | `getTodayNY()`, `daysRemainingInMonth()` (inclusive of today, min 1), `daysArrayForMonth`, `cumulativeFromDailyTotals`, `resolveStopDay` |
| Status, projection | `computeBudgetStatusV2` already returns `advicePerDay`, `projectedSavings` and `savingsStatus` |

### 4.2 Formula
Notation: month `M` with `D` days, `t` = today's day-of-month in America/New_York (only when `M` is the current NY month), and `f(d)` = flexible spend dated on day `d`. `C(d) = Σ_{k≤d} f(k)` and `C(0) = 0`.

```
billsReserved   R  = max(B, Bp)                          // = Bp + max(0, B − Bp): unpaid bills stay reserved
flexibleBudget  F  = I − S − R                           // what is left for discretionary spend this month
daysLeftAt(d)      = D − d + 1                           // inclusive of day d (matches daysRemainingInMonth)

allowanceRaw(d) = (F − C(d − 1)) / daysLeftAt(d)         // START-OF-DAY snapshot: today's spend does not move today's number
allowance(d)    = max(0, floor(allowanceRaw(d)))         // whole dollars, clamped (RM: max(·,0) then round)

today (d = t):
  todayAllowance   = allowance(t)
  todaySpent       = f(t)                                // includes pending
  todayLeft        = todayAllowance − todaySpent         // may be negative → "over by"
  tomorrowAllowance= t < D ? max(0, floor((F − C(t)) / (D − t))) : null
  remaining        = F − C(t)                            // month-level flexible left (may be negative)

pace(d)            = F × d / D                           // straight-line ideal cumulative for the chart
projectedSavings   = I − R − C(t) − a × (D − t)          // RM's formula, but with flexible-only spend and bills reserved
pctOfTarget        = S > 0 ? round(projectedSavings / S × 100) : null
```

**Status.** Apply RM's thresholds in RM's order:
1. `no_income` when `I = 0 && !usingOverride`.
2. `over_budget` when `remaining < 0`.
3. With `S > 0`: `super_saver` when pct ≥ 105, `on_track` when pct ≥ 99, otherwise `at_risk`.
4. With `S = 0`: `on_track` when projectedSavings ≥ 0, otherwise `at_risk`.

Why the start-of-day snapshot? RM recomputes the allowance live, which means buying a coffee also lowers *today's* allowance. That makes it hard to read "how much is left today". Freezing today's allowance at 00:00 NY, and showing `todayLeft = allowance − spentToday`, gives a stable number. The roll-forward happens tomorrow: `tomorrowAllowance` already reflects today's over- or under-spend.

Why `D − d + 1` (today included) rather than RM's `D − day` (today excluded)? It keeps the endpoint consistent with Financify's existing `daysRemainingInMonth`, which `advicePerDay` already uses. It also means the allowance is never undefined on the last day (`daysLeftAt(D) = 1`). This is a deliberate change from RM.

### 4.3 Edge cases
| Case | Rule |
|---|---|
| **No income** (`I = 0`, no override) | `status: 'no_income'`. `plan.flexibleBudget`, every `allowance`, `pace`, `today.allowance` and `projectedSavings` are `null`. `spent` and `cumulative` are still returned so the chart can render. UI CTA: "Set your monthly income" → Settings |
| **Override set to 0** | Valid. `F = −S − R` is negative, so the status is `over_budget` with allowance 0 |
| **Savings target 0 / unset** | `F = I − R`. `pctOfTarget = null`. Status uses the `S = 0` branch |
| **Negative remaining** (`F − C(d−1) < 0`) | `allowanceRaw` is negative, `allowance = 0`, and `today.overBy = −remaining`. Never show a negative per-day figure (RM clamps too). `computeBudgetStatusV2`'s uncapped `advicePerDay` stays as it is for its existing consumers |
| **F negative from day 1** (target + bills exceed income) | All allowances are 0 and the status is `over_budget`. Add `plan.isFeasible = false` so the UI can say "Your savings target is higher than income after bills" |
| **Month start** (`t = 1`) | `C(0) = 0`, so `allowance(1) = F / D`. The 30-day average still uses last month's tail, which is fine |
| **Month end** (`t = D`) | `daysLeftAt = 1`, so the allowance is all of `remaining`. `tomorrowAllowance = null`. Copy: "{X} for today" (RM's last-day wording) |
| **Today's partial spend** | `f(t)` includes pending. Today's allowance does not change during the day. `todayLeft` falls as spend lands |
| **Pending → posted** with a date shift | Bucket by `t.date` as stored. A posted txn can move to an earlier day. Recomputing on each request handles that |
| **Refunds** (negative expense amounts) | Keep `amount > 0` to match `flexibleSpentThisMonth`. Refunds don't raise the allowance. Revisit together with the existing metric |
| **America/New_York boundary** | "Today" is `getTodayNY()` (server). Days are Plaid `t.date` calendar dates; **never** derive them from the UTC timestamp. A txn dated after `todayNY` (Plaid skew) is clamped into today's bucket. `daysInMonth` comes from `new Date(y, m, 0)` on the `YYYY-MM` string, so the server's time zone doesn't matter |
| **Past month** (`month < current`) | `today = null`. `allowance(d)` is computed historically, so the chart shows how the allowance moved. Status uses final numbers (`a × 0`). Past-month verdict thresholds: ≤98.9 / ≤101 / ≤109.9 / >109.9 % of `F` spent → under / right on / slightly over / over |
| **Future month** | `400 { error: 'future_month' }` |
| **Bills paid exceed expected** | `R = max(B, Bp)` absorbs it, so no bill is double-counted |
| **Excluded / transfer / income txns** | Excluded by the existing filters (`is_excluded`, category group) |
| **Rounding** | Compute in cents (or numeric strings) and floor only the displayed allowance. `money` fields are dollars rounded to 2 dp, following the contract convention |

---

## 5. PROPOSED JSON SHAPE: `GET /api/mobile/daily-spend?month=YYYY-MM`

`month` defaults to the current NY month. Add this to `src/contracts/mobile-api.ts` (types only):

```ts
// GET /api/mobile/daily-spend?month=YYYY-MM
export type DailySpendStatus =
  | 'super_saver'   // projected ≥ 105 % of target
  | 'on_track'      // ≥ 99 % (or target 0 and projected ≥ 0)
  | 'at_risk'       // below 99 %
  | 'over_budget'   // flexible spend already exceeds the flexible budget
  | 'no_income';    // no income estimate and no override → allowance unavailable

export interface DailySpendDay {
  /** "YYYY-MM-DD" (America/New_York calendar day). */
  date: string;
  /** 1-based day of month. */
  day: number;
  /** Flexible (non-bill, non-excluded) spend dated this day, dollars. 0 for future days. */
  spent: number;
  /** Start-of-day allowance for this day, whole dollars, ≥ 0. null when status is 'no_income'.
   *  Future days carry today's tomorrowAllowance (the even split if today lands on plan). */
  allowance: number | null;
  /** Running flexible spend through the end of this day. null for days after today. */
  cumulative: number | null;
  /** Ideal straight-line cumulative F × day / D. null when status is 'no_income'. */
  pace: number | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface DailySpendToday {
  date: string;
  /** Days left in the month including today (≥ 1). */
  daysRemaining: number;
  /** Today's allowance, frozen at start of day (whole dollars, ≥ 0). null when 'no_income'. */
  allowance: number | null;
  /** Unclamped allowance before rounding — negative means already over. */
  allowanceRaw: number | null;
  /** Flexible spend so far today, pending included. */
  spent: number;
  /** allowance − spent; negative = over today's allowance. */
  left: number | null;
  /** What tomorrow's allowance becomes given today's spend so far. null on the last day. */
  tomorrowAllowance: number | null;
  /** Positive amount the month is over the flexible budget, else 0. */
  overBy: number;
}

export interface DailySpendResponse {
  month: string;
  isCurrentMonth: boolean;
  daysInMonth: number;
  plan: {
    income: number;
    usingIncomeOverride: boolean;
    savingsTarget: number;
    /** Monthly-normalised expected bills from active bill streams. */
    billsExpected: number;
    billsPaid: number;
    billsLeftToPay: number;
    /** I − S − max(billsExpected, billsPaid). null when 'no_income'. */
    flexibleBudget: number | null;
    /** false when the target plus bills exceed income. */
    isFeasible: boolean;
  };
  totals: {
    flexibleSpent: number;
    /** flexibleBudget − flexibleSpent (may be negative). null when 'no_income'. */
    remaining: number | null;
    /** Trailing-30-day flexible spend ÷ 30. */
    averagePerDay: number;
    /** I − R − flexibleSpent − averagePerDay × days after today. null when 'no_income'. */
    projectedSavings: number | null;
    /** round(projectedSavings / savingsTarget × 100); null when target is 0 or 'no_income'. */
    percentOfTarget: number | null;
  };
  status: DailySpendStatus;
  /** Ready-to-render headline and sentence for the hero (server-owned so copy can change without a release). */
  copy: { title: string; body: string; chip: string };
  /** null for past months. */
  today: DailySpendToday | null;
  /** One entry per calendar day of the month, day 1 … daysInMonth. */
  days: DailySpendDay[];
}
```

Suggested Financify copy. It keeps RM's structure in our own words; the RM originals are in §3.6.

| status | chip | title | body |
|---|---|---|---|
| super_saver | Ahead | You're ahead of plan | Keep it under **{X}** a day and you'll beat your savings goal. |
| on_track | On track | Right on plan | Spend less than **{X}** a day to hit your savings goal. |
| at_risk | At risk | Ease off a little | Drop to **{X}** a day for the rest of the month to still hit your goal. |
| over_budget | Over | Over your plan | You've used this month's spending money; new spend comes out of savings. |
| no_income | — | Set your income | Add your monthly income in Settings to see a daily allowance. |
| (last day) | | | "{X} for today" replaces "a day". Today line: "{left} left today" / "{-left} over today" |

## 6. Suggested UI (Financify), built from RM's pieces
1. **Hero card** (dashboard carousel page 1, or the top of Spending): "Today you can spend" label, the allowance in the money hero style (see polish-gaps #1), the chip at top right with RM's success/warning chip tokens, then "{left} left today · {N} days left".
2. **Per-day bars:** a 28–31 bar mini chart of `days[].spent`, past bars in `chartLine` and today's bar outlined. Draw `allowance` as a stepped dashed line (RM `DashPathEffect`, 1 px, `#545454`). Bars over that day's allowance use warning `#FF9124`. Y ticks follow RM's `[0, max/2, max]`.
3. **Cumulative vs. pace:** reuse `SpendChart` with `current = days.cumulative` and `budget/pace = days.pace` (a dashed diagonal instead of the flat BUDGET line).
4. **Info sheet:** RM's modal rows: Days Remaining, Left for spending, 30-day average, Projected savings sentence.

Skipped: RM's live (non-snapshot) recompute, the Safe-to-Spend cash-flow mode, and the edit-target slider UI (Settings already has the field).
