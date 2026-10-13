# Rocket Money iOS — REA capture (rebuild reference)

**TL;DR.** Rocket Money v16.5.0 (build 14097, `com.truebill.truebillnative`) is an Expo/React Native app compiled to Hermes bytecode v98. I recovered the navigation structure, all 282 semantic colour tokens in dark and light mode, the type scale, corner radii and core copy. The dark UI is near-monochrome: `#1B1B1B` canvas, `#2B2B2B` cards, white text, periwinkle `#7392FC` charts. Brand red appears in only 27 tokens. Dark mode barely uses red; the selected tab and primary buttons are white. So "blue instead of red" means swapping those 27 tokens to a `#3B82F6` scale, and optionally making the selected tab blue.

This is a reference for rebuilding only. No RM code, images, fonts (WNTL Text / Bowtie Display are licensed), Lottie or Rive files may be copied into Financify.

---

## 0. Method and evidence

| Source | Tool | What it gave |
|---|---|---|
| `main.jsbundle` (24.7 MB, HBC v98) | REA `analyze_javascript_application` | 0 JS files parsed. REA's JS analyser can't read Hermes bytecode. |
| same | `hermes-dec` (P1sec, source install) → string table (120,348 strings), per-function bytecode index, object-literal buffer dump (145,302 objects) | Routes, tab config, token tables, typography, component names, copy |
| `assets/` (596 files) | file listing, plus a few PNGs viewed | Icon/illustration inventory; dark dashboard mockups used to sample pixel colours |
| `Assets.car` | `assetutil --info` | Only the app icon, splash logo and a few gradients. Not useful. |

Key functions in the bytecode: `getTabRoutes#44736` (tab order), `BottomTabIcon#44729` (icons), `useTabName#44720` (labels), fn `3571` / `3572` (dark / light token tables), fn `3584` (font tokens), fn `3580` (radii), fn `3629` (text styles), fn `6946` (dashboard card registry).

Confidence is **high** for tokens, tab order, icons and labels, which are literal values in the bundle. It is **medium** for per-screen layout: much of the rendering lives in child modules, so I filled gaps from the dark mockups and RM's public UI.

---

## 1. Navigation map

**Bottom tab bar** (custom `tabBar`, 5 slots; the selected tab gets a 2 px line *above* its icon plus a white/brand label):

| # | Route | Label | Icon (RM name → suggested Lucide) | Notes |
|---|---|---|---|---|
| 1 | `Home_Dashboard` | Dashboard | `dashboard` → `LayoutGrid` | Card feed |
| 2 | `Home_Recurring` | Recurring | `eventRepeat` → `CalendarSync` / `Repeat` | Onboarding badge dot |
| 3 | `Home_Spending` | Spending | `moneyStack` → `Banknote` | Onboarding badge dot |
| 4 | `Home_Transactions` | Transactions | `search` → `Search` | |
| 5 | More | More | hamburger → `Menu` | Opens a sheet with the overflow routes |

**More menu routes**, built from feature flags in `getTabRoutes`, in this order: Goals / Savings (`goal`), **Net Worth** (`chartUp` → `TrendingUp`), Credit Score (`score`), Debt Pay Down, Budget, Learning. Settings is reached from the gear icon on the Dashboard header.

**Stacks and sheets** (names from the bytecode):
- **Recurring:** top tabs `Recurring_Upcoming` ("Upcoming") and `Recurring_All` ("All"). Also `HomeStack_RecurringCalendar` (month calendar), `UpcomingSubscriptionScreen`, `AddBill` / `ManualBillCreate`, `AssignTransactionToSubscriptionScreen`.
- **Spending:** `SpendingBreakdown` (category / merchant / tag tabs), `CategoryScreen`, `BudgetScreen`, `ManageBudgetScreen`, `EditCategoryBudgetItemScreen`, `ProjectedSpendDetailsScreen`.
- **Transactions:** `TransactionsListScreen` with a `HeaderSearchInput` ("Search my transactions"), `TransactionsList_FilterSort` (filter by account / amount / date / name, sort), `TransactionDetailScreen`, sheets for rename / note / ignore / category / tags, `TransactionAddScreen`, `ManageTransactionRules*`, bulk edit ("Select Transactions").
- **Net Worth:** top tabs `Grow_Summary` / `Grow_Assets` / `Grow_Debt` ("Summary / Assets / Debt"), `NetWorthUpdateAmountSheet`, `AddAssetScreen` / `AddDebtScreen`, `NetWorthFAQ`.
- **Settings:** `SettingsProfileScreen`, `SettingsFinancialAccountsScreen`, `SettingsNotificationsScreen`, `SettingsAppAppearanceScreen`, `SettingsHelpScreen`, log out.

---

## 2. Screens (top → bottom)

Every tab screen uses `ScreenWrapper` on `rm-color-surface-default`, with a `HomeScreenPseudoHeader`: a large left-aligned title (HeadingRegular 28/36) and right-side actions. In light mode the header sits on a "sunbeam" gradient; in dark mode it is flat `#1B1B1B`.

### 2.1 Dashboard
1. **Header:** gear icon (Settings) on the left, centred wordmark, bell (notifications) on the right. Financify uses its own wordmark.
2. **Swipe carousel** ("SwipeyCards"), with three pagination dots below (`carouselPagination`):
   - **Current spend card.** Label "Current spend this month", amount in HeadingXLarge (~36/44). On the right a check-circle badge with "$98 below avg. spend" (or above). Below that, a cumulative-spend line chart for this month (`#7392FC` line, `#323F6B` area under it, white end dot) against a dashed **BUDGET** line labelled in Tracked caps. Footer row: cash icon, "Payday in N days", info icon.
   - Other pages: last-month overview, and income vs. spend.
3. **ACCOUNTS** section header (Tracked caps) with an underlined "Add account" link on the right.
   - A grouped card. Rows: **Checking**, **Card Balance**, **Net Cash** (green, info icon: "What is Net Cash?"). Then a gap and a second group: **Savings**, **Investments** (plus Loans and Real Estate when present). Each row has a line icon, label, amount and a chevron that expands to the individual accounts.
   - Below the card: a sync icon, "19 hours ago | Sync now".
4. **Upcoming** card: horizontal scroll of upcoming bills (logo circle, amount, "in N days"), with "See all upcoming" → Recurring.
5. **Recent Transactions** card: the 5 latest rows, then "View all".
6. **Your Budget** card: spend vs. budget progress, "Left to Spend".
7. RM-only cards to skip: Credit Score, Challenges, Learn & Grow, Ways to Save, Complete Setup, Journey, Premium.

Card order is server-configured and can be customised (`DashboardConfigScreen`, "drag-and-drop-dashboard" experiment). Ship a fixed order.

### 2.2 Recurring
- Title "Recurring" with a "+" (AddBill) action.
- **Top segmented tabs:** "Upcoming" | "All" (`TabNavigationPrimaryOnDark`).
- **Upcoming:** a summary line (`RecurringChargesSummary`, e.g. "You have N recurring charges due in the next 7 days"), then a month calendar strip with merchant logos on due dates and income in green ("+$3.2k"), then sections of `RecurringChargeRow` (logo, name, frequency, amount, due date). Empty state: "You do not have any recurring charges within the next 7 days."
- **All:** grouped by type — **Subscriptions**, **Bills & Utilities**, **Credit Card Payments**, **Income**, **Inactive** — each with a section total.
- **Calendar view** (`RecurringCalendar`): month grid, prev/next navigation, and a footer with the month total.
- Row tap → detail: amount history bar chart (`RecurringExpensesBarChart`, "MMM yy"), list of past charges, edit frequency and amount. RM's "cancel subscription" lives here.

### 2.3 Spending
- Title "Spending". Month selector (`RelativeTimePeriodName`: This Month / Last Month / earlier months; weekly or monthly).
- **Spending trajectory chart:** cumulative spend this month vs. last month or average, with a dashed budget line and a legend (`SpendingTrajectoryLegend`). "Projected Spend" detail available.
- **Summary card** (`SpendingSummaryCard`) rows: **Income**, **Bills & Utilities**, **Spending** (discretionary), **Net Income**. When no budget exists, a "Start a budget" CTA: "Control your spend · Get recommended spend targets · Begin".
- **Breakdown card** (`SpendingBreakdown`) with tabs Categories / Merchants / Tags. Category rows (`SpendingRow`): coloured category icon, name, progress bar vs. budget, amount, "Left to Spend" / "Over Budget". A pie/donut variant also exists.
- Budget states: "On Track", "Under Budget", "Over Budget"; tile set Earnings / Bills / Spending (`*BudgetTile`).

### 2.4 Transactions
- Title "Transactions". Right-side actions: "+" (add manual transaction) and "…" (export, rules, select).
- **Search field:** "Search my transactions". Applied-filter chips below it (`AppliedFiltersChip`).
- **Sectioned list by day:** section header shows the date and "$X total spend". `TransactionRow`: 36 px logo or category icon, merchant name, category/account caption, amount on the right (income in success green, pending in subtle text).
- Swipe quick-actions (category, tags, ignore). Bulk edit via "Select Transactions".
- Empty state: "No transactions found".
- **Detail screen:** large amount, merchant, date, account, category (changeable), notes, tags, "Ignore" toggle ("Excluded from spending."), a related-history chart, and "Create a rule to apply to matching transactions".

### 2.5 Net Worth (More menu)
- Title "Net Worth". Top tabs: **Summary / Assets / Debt**.
- **Chart header** (`NetWorthChartHeader`): Total Net Worth in HeadingLarge, a delta caption "▲ $X (Y%) last month / last year", and a range selector **1M · 3M · 6M · 1Y · ALL**. Below it, a line or area chart.
- Summary: Total Assets row and Total Debt row, then grouped account rows (Checking, Savings, Investments, Real Estate, Vehicles, Other; Credit Cards, Loans). Each row has a "Include in Net Worth" toggle ("Toggle off to hide from net worth charts and calculations.").
- Assets / Debt tabs: the same chart filtered, plus the account list. Manual assets via "Add asset". FAQ link: "How is my net worth calculated?"

### 2.6 Settings
Profile, Accounts (linked institutions with status / "Fix connection"), Notifications, Appearance (System / Light / Dark), Help, Log out.

---

## 3. Design tokens

### 3.1 Core palette (dark is the default)

| Role | Token | Dark | Light |
|---|---|---|---|
| Canvas | `surface-default` / `screenNavigation-fill-primary` | `#1B1B1B` | `#FFFFFF` |
| Card | `fill-default` (mockup sample) | `#2B2B2B` | `#FFFFFF` |
| Card, subtle | `fill-subtle` | `#242424` | `#F7F7F7` |
| Accent fill / chip | `fill-accent`, `sectionHeader-fill-primary` | `#404040` | `#F2F2F2` |
| Hairline | `border-default` | `#545454` | `#E9E9E9` |
| Row divider (sampled) | — | `#454545` | — |
| Text | `text-default` | `#FFFFFF` | `#111111` |
| Text, subtle | `text-subtle` / `icon-subtle` / `chart-text-labels` | `#C1C1C1` | `#545454` |
| Text, ignored / tab inactive | `text-ignored` | `#949494` (tab sample `#6D6D6D`) | `#949494` |
| Positive / success | `text-semantic-success` | `#94CFAD` | `#0C783E` |
| Warning (metric) | `text-semantic-metricWarning` | `#FF9124` | `#B55003` |
| Chart line | `data-primary` | `#7392FC` | `#7392FC` |
| Chart area | `data-primary-areafill` | `#323F6B` | `#EDF1FF` |
| Chart secondary | `data-secondary` | `#3953AB` | `#3953AB` |
| Track | `fill-track` | `rgba(255,255,255,.15)` | `rgba(0,0,0,.10)` |
| Scrim | `surface-scrim` | `rgba(0,0,0,.8)` | same |
| Primary button | `button-fill-primary-enabled` | `#FFFFFF` (black text) | `#111111` |
| Tab bar | sampled: bg `#2B2B2B`, top border `#4D4D4D` | selected `#FFFFFF` | selected = brand |

### 3.2 Brand red → blue swap (27 tokens)
RM's brand scale is red50…900 = `#FEE7E7 #FFCACE #FFACB3 #F1878F #E95D68 #DE3341 #C12A36 #A3202B #84161F #610B12`. Map it step for step to a `#3B82F6` scale:

| RM red | → Blue | Used by |
|---|---|---|
| `#FEE7E7` (50) | `#EFF6FF` | `fill-brand-subtle` |
| `#FFCACE` (100) | `#DBEAFE` | Android cursor |
| `#F1878F` (300) | `#93C5FD` | `text-brand-bold` (dark) |
| `#E95D68` (400) | `#60A5FA` | `text-brand` (dark), pressed links, iOS cursor |
| `#DE3341` (500) | **`#3B82F6`** | `icon-brand`, `border-brand`, light `fill-brand`, light `text-brand`, light tab selected, `alwaysSunbeam-end` |
| `#C12A36` (600) | `#2563EB` | dark `fill-brand` |
| `#A3202B` (700) | `#1D4ED8` | light `text-brand-bold`, pressed links |
| `#84161F` (800) | `#1E40AF` | `button-fill-primary-pressed`, light pressed text |

Recommendation: in dark mode make `tabBar-*-selected` blue (`#3B82F6`) rather than RM's white, so the theme reads as blue. The light-mode "sunbeam" header gradient goes from `#A42663` to `#DE3341`; replace it with `#1E3A8A → #3B82F6`.

The full 282-token dark/light table, with swap flags, is in Appendix A.

### 3.3 Category colours (`rm-color-category-*`, the same in both modes)
| Category | Hex |
|---|---|
| Auto | `#0FA1A9` |
| Bills & Utilities | `#377EB8` |
| Dining & Drinks | `#5569D8` |
| Entertainment & Rec | `#E67300` |
| Everything Else | `#1C7AF9` |
| Groceries | `#C42E60` |
| Health & Wellness | `#00A2B8` |
| Shopping | `#C28B00` |
| Travel & Vacation | `#FC6031` |
| Income | `#3FA291` |

Other categories (business, cashChecks, charitable, education, familyCare, fees, gifts, homeGarden, legal, loanPayment, medical, personalCare, pets, softwareTech, taxes, uncategorized, plus non-spending) are in Appendix A.

### 3.4 Typography
Fonts: sans `WNTL Text` (Regular / Medium / DemiBold), display serif `Bowtie Display`, mono `Courier Prime`. All are proprietary or shipped in the bundle. **Substitute Inter or SF Pro (system)** for WNTL Text and skip the serif. Heading letter-spacing is −1. Tracked style is 12/12 medium, uppercase, +0.6 tracking.

| Style | Size / line | Weight |
|---|---|---|
| HeadingXXLarge | 48/56 | medium (−1 ls) |
| HeadingXLarge | 36/44 | medium (−1) |
| HeadingLarge | 32/40 | medium (−1) |
| HeadingRegular | 28/36 | medium (−1) |
| HeadingSmall | 24/32 | medium |
| HeadingXSmall | 20/28 | medium |
| HeadingXXSmall | 18/24 | medium |
| LabelLarge / Regular / Small | 18/24 · 16/24 · 14/20 | medium |
| ParagraphXLarge / Large / Regular | 18/28 · 16/24 · 14/20 | regular |
| CaptionRegular / Small | 12/16 · 10/15 | regular |
| Tracked | 12/12, uppercase, +0.6 | medium |

### 3.5 Shape and spacing
- **Radii:** small 6, medium 16 (cards), large 24 (hero cards and sheets), round 9999, banner 8.
- **Spacing:** the 8-pt grid shown in the mockups — 16 screen gutter, 16–20 card padding, rows about 56–64 tall.
- **Cards:** flat `#2B2B2B` with no shadow and no border in dark mode; grouped rows separated by `#454545` hairlines. Light mode uses a white card with a hairline border.
- **Charts:** smooth monotone lines 2–3 px, area fill as above, dashed reference lines `#545454` with a Tracked label, axis `#7B7B7B`, end-point dot white.

---

## 4. Feature inventory

| Feature | Tag | Notes |
|---|---|---|
| Dashboard: current-spend chart, payday, accounts summary, net cash, sync | PLAID-FEASIBLE | "Payday" is inferred from income streams |
| Upcoming bills (dashboard and Recurring) | PLAID-FEASIBLE | Plaid recurring streams |
| Recurring: Upcoming / All / Calendar / detail history | PLAID-FEASIBLE | |
| Spending: trajectory, income / bills / spend / net summary, category breakdown, budgets | PLAID-FEASIBLE | Budgets already exist in Financify |
| Merchants breakdown | PLAID-FEASIBLE | Group by `merchant_name` |
| Transactions: search, filters, day sections, detail, recategorise, notes, ignore, rules | PLAID-FEASIBLE | Rules and notes already exist |
| Tags, split transactions, manual transactions, export CSV | PLAID-FEASIBLE (new) | Need small schema additions; optional |
| Net Worth: Summary / Assets / Debt, ranges, include toggle | PLAID-FEASIBLE | Needs a balance-history series; manual assets are optional |
| Balance alerts, upcoming-bill notifications | PLAID-FEASIBLE (later) | Needs push |
| Watchlist, weekly review, streaks | Feasible but SKIP | Engagement features |
| Subscription cancellation, bill negotiation, fee refunds | NEEDS-RM-SERVICE | |
| Credit score / report, debt paydown with credit data | NEEDS-RM-SERVICE | |
| Premium, HYSA / Smart Savings, Goals transfers, Rocket loans, offers, AI assistant ("Rowan"), challenges, learning | NEEDS-RM-SERVICE / SKIP | |

---

## 5. Data each screen needs (for JSON endpoints)

| Screen | Data | Existing Financify source (`src/domain/metrics.ts`) | Gap |
|---|---|---|---|
| Dashboard spend card | month spend so far, prior / average spend, cumulative daily series, budget total, days to payday | `getMonthSpend`, `getBudgetStatusV2`, `getMonthlyIncomeEstimate` | **Cumulative daily spend series** (this month and last); **next payday** from income streams |
| Dashboard accounts | balances grouped as checking / card / savings / investments / loans, net cash, last sync | `getAccounts`, `getNetWorth` | Grouping by type/subtype (client side is fine); net cash = checking − credit |
| Upcoming card / Recurring Upcoming | upcoming streams, due date, amount, logo | `getRecurringMonth` (`upcoming`, `leftToPay`) | Next 7/30 days window across month boundaries; merchant logo URL |
| Recurring All | all streams grouped (subscriptions / bills / credit card / income / inactive) with frequency | `getRecurringMonth` (bills only) | **All streams, including inflows and inactive**, with frequency and type |
| Recurring detail | past charges for a stream | — | Transactions by stream id |
| Spending summary | income, bills, discretionary spend, net income | `getMonthSpend`, `getRecurringMonth` | Split bills from discretionary (category group or recurring match) |
| Spending trajectory | daily cumulative this month vs. last | — | Same series as the dashboard |
| Spending breakdown | per-category spent and budget; per-merchant totals | `getCategoryBreakdown`, `getBudgetStatusV2` | Merchant aggregation |
| 12-month bars | monthly totals | `getMonthlySeries` | — |
| Transactions | paged, filtered and searchable list; day totals | `getTransactions` (cursor, q, month, category, account) | Day subtotal (client side); amount / date-range filters |
| Transaction detail / edit | row, category change, note, ignore | `PATCH /api/transactions/[id]`, category-rules routes | Related history (same merchant) |
| Net Worth | current totals, per-account rows, history by range | `getNetWorth`, `getAccounts`, `getBalanceHistory(accountId)` | **Aggregate net-worth history** across accounts for 1M–ALL; include/exclude flag (`isHidden` could be reused) |
| Settings | items / accounts status, sync trigger, budgets, income override | `/api/settings`, `/api/sync/trigger`, `/api/plaid/link/*` | — |

---

## 6. Gaps and open items
- Per-screen pixel spacing is inferred from 2 dark mockups, not measured from live screens. A running device capture would confirm it.
- The "Recurring All" sub-tab label wasn't found as a literal ("Upcoming" was). The group headings above come from the string table.
- The dashboard swipe-carousel pages other than "Current spend" are inferred from component names.
- The icon set is RM's own; map it to Lucide (see §1) rather than extracting it.

---

## Appendix A — full token table (dark / light; SWAP = brand red → blue scale)

| Token | Dark | Light | Brand red |
|---|---|---|---|
| `rm-color-surface-alwaysDark` | `#111111` | `#111111` |  |
| `rm-color-surface-alwaysLight` | `#ffffff` | `#ffffff` |  |
| `rm-color-surface-bold` | `#ffffff` | `#111111` |  |
| `rm-color-surface-default` | `#1b1b1b` | `#ffffff` |  |
| `rm-color-surface-premium-subtle` | `#f1ebff` | `#f1ebff` |  |
| `rm-color-surface-putty` | `#1b1b1b` | `#f3eee7` |  |
| `rm-color-surface-scrim` | `rgba(0, 0, 0, 0.8)` | `rgba(0, 0, 0, 0.8)` |  |
| `rm-color-surface-subtle` | `#1b1b1b` | `#f7f7f7` |  |
| `rm-color-surface-sunbeam-end` | `#1b1b1b` | `#de3341` | **SWAP** |
| `rm-color-surface-sunbeam-start` | `#1b1b1b` | `#a42663` |  |
| `rm-color-fill-accent` | `#404040` | `#f2f2f2` |  |
| `rm-color-fill-alwaysDark` | `#111111` | `#111111` |  |
| `rm-color-fill-alwaysLight` | `#ffffff` | `#ffffff` |  |
| `rm-color-fill-alwaysLight-subtle` | `#c1c1c1` | `#f2f2f2` |  |
| `rm-color-fill-bold` | `#ffffff` | `#111111` |  |
| `rm-color-fill-brand` | `#c12a36` | `#de3341` | **SWAP** |
| `rm-color-fill-brand-subtle` | `#fee7e7` | `#fee7e7` | **SWAP** |
| `rm-color-fill-custom-dataGreen-bold` | `#7d7b4f` | `#7d7b4f` |  |
| `rm-color-fill-custom-dataGreen-subtle` | `#dfddc3` | `#f0eed9` |  |
| `rm-color-fill-custom-dataOrange-bold` | `#b56232` | `#b56232` |  |
| `rm-color-fill-custom-dataOrange-subtle` | `#fdbc96` | `#f4e4da` |  |
| `rm-color-fill-custom-dataPurple-bold` | `#9e3f71` | `#9e3f71` |  |
| `rm-color-fill-custom-dataPurple-subtle` | `#f1dbe7` | `#fbf0f6` |  |
| `rm-color-fill-default` | `#2b2b2b` | `#ffffff` |  |
| `rm-color-fill-disabled` | `#949494` | `#949494` |  |
| `rm-color-fill-dragHandle` | `#545454` | `rgba(255, 255, 255, 0.8)` |  |
| `rm-color-fill-iconContainer` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.05)` |  |
| `rm-color-fill-premium` | `#aa80e7` | `#5b3c9c` |  |
| `rm-color-fill-premium-subtle` | `#f1ebff` | `#f1ebff` |  |
| `rm-color-fill-semantic-info` | `#2a396f` | `#4156a1` |  |
| `rm-color-fill-semantic-info-subtle` | `#adc6f6` | `#edf1ff` |  |
| `rm-color-fill-semantic-metricWarning` | `#c25400` | `#c25400` |  |
| `rm-color-fill-semantic-metricWarning-subtle` | `#ffe6cc` | `#fef1e6` |  |
| `rm-color-fill-semantic-success` | `#0b5e36` | `#0c783e` |  |
| `rm-color-fill-semantic-success-subtle` | `#b5ddc6` | `#e7f3ed` |  |
| `rm-color-fill-semantic-systemWarning` | `#ffbf51` | `#ffbf51` |  |
| `rm-color-fill-semantic-systemWarning-subtle` | `#ffe5b8` | `#fff5e4` |  |
| `rm-color-fill-subtle` | `#242424` | `#f7f7f7` |  |
| `rm-color-fill-track` | `rgba(255, 255, 255, 0.15)` | `rgba(0, 0, 0, 0.1)` |  |
| `rm-color-fill-track-alwaysDark` | `rgba(0, 0, 0, 0.1)` | `rgba(0, 0, 0, 0.1)` |  |
| `rm-color-fill-track-alwaysLight` | `rgba(255, 255, 255, 0.15)` | `rgba(255, 255, 255, 0.15)` |  |
| `rm-color-fill-translucent` | `rgba(255, 255, 255, 0.15)` | `rgba(255, 255, 255, 0.15)` |  |
| `rm-color-text-alwaysDark` | `#111111` | `#111111` |  |
| `rm-color-text-alwaysDark-subtle` | `#545454` | `#545454` |  |
| `rm-color-text-alwaysLight` | `#ffffff` | `#ffffff` |  |
| `rm-color-text-alwaysLight-subtle` | `rgba(255, 255, 255, 0.8)` | `#f2f2f2` |  |
| `rm-color-text-brand` | `#e95d68` | `#de3341` | **SWAP** |
| `rm-color-text-brand-bold` | `#f1878f` | `#a3202b` | **SWAP** |
| `rm-color-text-brand-pressed` | `#de3341` | `#84161f` | **SWAP** |
| `rm-color-text-custom-dataGreen` | `#373620` | `#373620` |  |
| `rm-color-text-custom-dataOrange` | `#732612` | `#732612` |  |
| `rm-color-text-custom-dataPurple` | `#441227` | `#441227` |  |
| `rm-color-text-data` | `#7392fc` | `#3953ab` |  |
| `rm-color-text-default` | `#ffffff` | `#111111` |  |
| `rm-color-text-disabled` | `#7b7b7b` | `#7b7b7b` |  |
| `rm-color-text-ignored` | `#949494` | `#949494` |  |
| `rm-color-text-inverse` | `#111111` | `#ffffff` |  |
| `rm-color-text-placeholder` | `#c1c1c1` | `#7b7b7b` |  |
| `rm-color-text-premium` | `#aa80e7` | `#5b3c9c` |  |
| `rm-color-text-semantic-info` | `#adc6f6` | `#4156a1` |  |
| `rm-color-text-semantic-info-bold` | `#354c9e` | `#4156a1` |  |
| `rm-color-text-semantic-metricWarning` | `#ff9124` | `#b55003` |  |
| `rm-color-text-semantic-metricWarning-bold` | `#af4b04` | `#ba4e00` |  |
| `rm-color-text-semantic-success` | `#94cfad` | `#0c783e` |  |
| `rm-color-text-semantic-success-bold` | `#0b5e36` | `#0c783e` |  |
| `rm-color-text-semantic-systemWarning` | `#eaab3e` | `#986717` |  |
| `rm-color-text-semantic-systemWarning-bold` | `#866200` | `#986717` |  |
| `rm-color-text-subtle` | `#c1c1c1` | `#545454` |  |
| `rm-color-icon-alwaysDark` | `#111111` | `#111111` |  |
| `rm-color-icon-alwaysLight` | `#ffffff` | `#ffffff` |  |
| `rm-color-icon-brand` | `#de3341` | `#de3341` | **SWAP** |
| `rm-color-icon-brand-bold` | `#de3341` | `#a3202b` | **SWAP** |
| `rm-color-icon-brand-pressed` | `#e95d68` | `#84161f` | **SWAP** |
| `rm-color-icon-custom-dataGreen` | `#7d7b4f` | `#7d7b4f` |  |
| `rm-color-icon-custom-dataOrange` | `#b56232` | `#b56232` |  |
| `rm-color-icon-custom-dataPurple` | `#9e3f71` | `#9e3f71` |  |
| `rm-color-icon-data-primary` | `#3953ab` | `#3953ab` |  |
| `rm-color-icon-default` | `#ffffff` | `#111111` |  |
| `rm-color-icon-disabled` | `#949494` | `#c1c1c1` |  |
| `rm-color-icon-inverse` | `#111111` | `#ffffff` |  |
| `rm-color-icon-placeholder` | `#c1c1c1` | `#7b7b7b` |  |
| `rm-color-icon-premium` | `#aa80e7` | `#5b3c9c` |  |
| `rm-color-icon-semantic-info` | `#adc6f6` | `#4156a1` |  |
| `rm-color-icon-semantic-info-bold` | `#354c9e` | `#4156a1` |  |
| `rm-color-icon-semantic-metricWarning` | `#ff9124` | `#b55003` |  |
| `rm-color-icon-semantic-metricWarning-bold` | `#af4b04` | `#ba4e00` |  |
| `rm-color-icon-semantic-success` | `#94cfad` | `#0c783e` |  |
| `rm-color-icon-semantic-success-bold` | `#0b5e36` | `#0c783e` |  |
| `rm-color-icon-semantic-systemWarning` | `#eaab3e` | `#986717` |  |
| `rm-color-icon-semantic-systemWarning-bold` | `#866200` | `#986717` |  |
| `rm-color-icon-subtle` | `#c1c1c1` | `#545454` |  |
| `rm-color-border-alwaysDark` | `#111111` | `#111111` |  |
| `rm-color-border-alwaysLight` | `#ffffff` | `#ffffff` |  |
| `rm-color-border-bold` | `#ffffff` | `#111111` |  |
| `rm-color-border-brand` | `#de3341` | `#de3341` | **SWAP** |
| `rm-color-border-custom-green` | `#cbc996` | `#cbc996` |  |
| `rm-color-border-custom-orange` | `#ff9e66` | `#ff9e66` |  |
| `rm-color-border-custom-purple` | `#f099c7` | `#f099c7` |  |
| `rm-color-border-default` | `#545454` | `#e9e9e9` |  |
| `rm-color-border-inverse` | `#1b1b1b` | `#ffffff` |  |
| `rm-color-border-premium` | `#aa80e7` | `#5b3c9c` |  |
| `rm-color-border-semantic-info` | `#354c9e` | `#4156a1` |  |
| `rm-color-border-semantic-info-subtle` | `#354c9e` | `#95b9fc` |  |
| `rm-color-border-semantic-metricWarning` | `#c25400` | `#c25400` |  |
| `rm-color-border-semantic-success` | `#94cfad` | `#0c783e` |  |
| `rm-color-border-semantic-success-subtle` | `#51b179` | `#b5ddc6` |  |
| `rm-color-border-semantic-systemWarning` | `#c78b23` | `#c78b23` |  |
| `rm-color-border-translucent` | `rgba(255, 255, 255, 0.4)` | `rgba(255, 255, 255, 0.4)` |  |
| `rm-color-data-primary` | `#7392fc` | `#7392fc` |  |
| `rm-color-data-primary-areafill` | `#323f6b` | `#edf1ff` |  |
| `rm-color-data-secondary` | `#3953ab` | `#3953ab` |  |
| `rm-color-data-secondary-areafill` | `#d2d9f4` | `#d2d9f4` |  |
| `rm-color-data-tertiary` | `#d2d9f4` | `#21273d` |  |
| `rm-color-data-tertiary-alwaysDark` | `#21273d` | `#21273d` |  |
| `rm-color-chart-border-axis` | `#7b7b7b` | `#e9e9e9` |  |
| `rm-color-chart-fill-area` | `rgba(255, 255, 255, 0.15)` | `#d2d9f4` |  |
| `rm-color-chart-text-labels` | `#c1c1c1` | `#545454` |  |
| `rm-color-category-custom-clearSkies` | `#149cd6` | `#149cd6` |  |
| `rm-color-category-custom-crimsonBlaze` | `#c42a20` | `#c42a20` |  |
| `rm-color-category-custom-figJam` | `#971cd1` | `#971cd1` |  |
| `rm-color-category-custom-goldenOpportunity` | `#d8b501` | `#d8b501` |  |
| `rm-color-category-custom-greenerPastures` | `#3fb24b` | `#3fb24b` |  |
| `rm-color-category-custom-magentaMagic` | `#d02462` | `#d02462` |  |
| `rm-color-category-custom-mintCondition` | `#1dc1b7` | `#1dc1b7` |  |
| `rm-color-category-custom-moodIndigo` | `#5d33d6` | `#5d33d6` |  |
| `rm-color-category-custom-oliveGrove` | `#9cbd16` | `#9cbd16` |  |
| `rm-color-category-custom-pinkPerfection` | `#d029d4` | `#d029d4` |  |
| `rm-color-category-custom-sunnySide` | `#de7412` | `#de7412` |  |
| `rm-color-category-custom-trueBlue` | `#3560d0` | `#3560d0` |  |
| `rm-color-category-meta-default` | `#949494` | `#949494` |  |
| `rm-color-category-nonSpending-creditCardPayment` | `#00a0d1` | `#00a0d1` |  |
| `rm-color-category-nonSpending-ignore` | `#757575` | `#757575` |  |
| `rm-color-category-nonSpending-income` | `#3fa291` | `#3fa291` |  |
| `rm-color-category-nonSpending-internalTransfers` | `#757575` | `#757575` |  |
| `rm-color-category-nonSpending-investment` | `#18a56d` | `#18a56d` |  |
| `rm-color-category-nonSpending-reimbursement` | `#007ef2` | `#007ef2` |  |
| `rm-color-category-nonSpending-savingsTransfer` | `#62a52c` | `#62a52c` |  |
| `rm-color-category-nonSpending-taxDeductible` | `#00a85f` | `#00a85f` |  |
| `rm-color-category-spending-auto` | `#0fa1a9` | `#0fa1a9` |  |
| `rm-color-category-spending-billsUtilities` | `#377eb8` | `#377eb8` |  |
| `rm-color-category-spending-business` | `#66a61e` | `#66a61e` |  |
| `rm-color-category-spending-cashChecks` | `#2ea86d` | `#2ea86d` |  |
| `rm-color-category-spending-charitableDonations` | `#749e00` | `#749e00` |  |
| `rm-color-category-spending-diningDrinks` | `#5569d8` | `#5569d8` |  |
| `rm-color-category-spending-education` | `#d95f02` | `#d95f02` |  |
| `rm-color-category-spending-entertainmentRec` | `#e67300` | `#e67300` |  |
| `rm-color-category-spending-everythingElse` | `#1c7af9` | `#1c7af9` |  |
| `rm-color-category-spending-familyCare` | `#e53977` | `#e53977` |  |
| `rm-color-category-spending-fees` | `#ff0000` | `#ff0000` |  |
| `rm-color-category-spending-gifts` | `#6639e5` | `#6639e5` |  |
| `rm-color-category-spending-groceries` | `#c42e60` | `#c42e60` |  |
| `rm-color-category-spending-healthWellness` | `#00a2b8` | `#00a2b8` |  |
| `rm-color-category-spending-homeGarden` | `#21ab2c` | `#21ab2c` |  |
| `rm-color-category-spending-legal` | `#fa6352` | `#fa6352` |  |
| `rm-color-category-spending-loanPayment` | `#5c9ac7` | `#5c9ac7` |  |
| `rm-color-category-spending-medical` | `#007ef2` | `#007ef2` |  |
| `rm-color-category-spending-personalCare` | `#f765a7` | `#f765a7` |  |
| `rm-color-category-spending-pets` | `#129fca` | `#129fca` |  |
| `rm-color-category-spending-shopping` | `#c28b00` | `#c28b00` |  |
| `rm-color-category-spending-softwareTech` | `#125fc4` | `#125fc4` |  |
| `rm-color-category-spending-taxes` | `#4478ad` | `#4478ad` |  |
| `rm-color-category-spending-travelVacation` | `#fc6031` | `#fc6031` |  |
| `rm-color-category-spending-uncategorized` | `#1c7af9` | `#1c7af9` |  |
| `rm-component-badge-border` | `#2b2b2b` | `#ffffff` |  |
| `rm-component-bannerFixed-fill-warning` | `#fed48d` | `#fed48d` |  |
| `rm-component-bannerInline-fill-primary` | `#404040` | `#f2f2f2` |  |
| `rm-component-bullet-fill-default` | `#ffffff` | `#111111` |  |
| `rm-component-bullet-fill-subtle` | `#c1c1c1` | `#545454` |  |
| `rm-component-button-fill-primary-enabled` | `#ffffff` | `#111111` |  |
| `rm-component-button-fill-primary-pressed` | `#84161f` | `#84161f` | **SWAP** |
| `rm-component-button-fill-primaryOnDark-pressed` | `rgba(255, 255, 255, 0.8)` | `rgba(255, 255, 255, 0.8)` |  |
| `rm-component-button-fill-secondary-enabled` | `rgba(255, 255, 255, 0)` | `#ffffff` |  |
| `rm-component-button-fill-secondary-pressed` | `rgba(0, 0, 0, 0.05)` | `rgba(0, 0, 0, 0.05)` |  |
| `rm-component-button-fill-secondaryOnDark-pressed` | `rgba(255, 255, 255, 0.1)` | `rgba(255, 255, 255, 0.1)` |  |
| `rm-component-button-fill-warning-enabled` | `#ffbf51` | `#ffbf51` |  |
| `rm-component-button-fill-warning-pressed` | `#eaab3e` | `#eaab3e` |  |
| `rm-component-button-icon-warning` | `#492800` | `#492800` |  |
| `rm-component-button-text-warning` | `#492800` | `#492800` |  |
| `rm-component-buttonToggle-border-primary` | `#2b2b2b` | `#e9e9e9` |  |
| `rm-component-buttonToggle-fill-track` | `#f7f7f7` | `#f7f7f7` |  |
| `rm-component-card-border-primary` | `#545454` | `#ffffff` |  |
| `rm-component-card-border-selected` | `#ffffff` | `#111111` |  |
| `rm-component-card-fill-pressed` | `rgba(0, 0, 0, 0.1)` | `rgba(0, 0, 0, 0.05)` |  |
| `rm-component-carouselPagination-fill-inactive` | `rgba(255, 255, 255, 0.15)` | `#c1c1c1` |  |
| `rm-component-categoryIconContained-baseColor` | `#ffffff` | `#ffffff` |  |
| `rm-component-chartNavigation-fill-incomeBar` | `#7392fc` | `#ffffff` |  |
| `rm-component-chip-fill-primary` | `#ffffff` | `#111111` |  |
| `rm-component-chip-fill-secondary` | `rgba(255, 255, 255, 0.15)` | `#e9e9e9` |  |
| `rm-component-chip-fill-systemWarning` | `#ffbf51` | `#ffbf51` |  |
| `rm-component-chip-icon-infoLight` | `#354c9e` | `#4156a1` |  |
| `rm-component-chip-icon-metricWarningLight` | `#c25400` | `#c25400` |  |
| `rm-component-chip-icon-successLight` | `#0b5e36` | `#0c783e` |  |
| `rm-component-chip-icon-systemWarningLight` | `#a06c17` | `#a06c17` |  |
| `rm-component-creditFactorGrade-A` | `#0c783e` | `#0c783e` |  |
| `rm-component-creditFactorGrade-B` | `#0c783e` | `#0c783e` |  |
| `rm-component-creditFactorGrade-C` | `#4156a1` | `#4156a1` |  |
| `rm-component-creditFactorGrade-D` | `#c25400` | `#c25400` |  |
| `rm-component-creditFactorGrade-unknown` | `#949494` | `#111111` |  |
| `rm-component-creditScore-excellent` | `#0c783e` | `#0c783e` |  |
| `rm-component-creditScore-fair` | `#7392fc` | `#7392fc` |  |
| `rm-component-creditScore-good` | `#0c783e` | `#0c783e` |  |
| `rm-component-creditScore-poor` | `#ff9e66` | `#ff9e66` |  |
| `rm-component-creditScore-veryGood` | `#0c783e` | `#0c783e` |  |
| `rm-component-headerSearchInput-fill-clear` | `#404040` | `rgba(0, 0, 0, 0.4)` |  |
| `rm-component-headerSearchInput-fill-clear-iconContainer` | `rgba(0, 0, 0, 0)` | `rgba(255, 255, 255, 0.1)` |  |
| `rm-component-input-border-focused` | `#7b7b7b` | `#c1c1c1` |  |
| `rm-component-input-cursor-android` | `#ffcace` | `#ffcace` | **SWAP** |
| `rm-component-input-cursor-ios` | `#e95d68` | `#de3341` | **SWAP** |
| `rm-component-input-fill-default` | `#404040` | `#f2f2f2` |  |
| `rm-component-input-text-error` | `#eaab3e` | `#845710` |  |
| `rm-component-link-border-inverse-pressed` | `#a3202b` | `#e95d68` | **SWAP** |
| `rm-component-link-border-primary-pressed` | `#e95d68` | `#a3202b` | **SWAP** |
| `rm-component-link-border-primaryOnDark-pressed` | `#e95d68` | `#e95d68` | **SWAP** |
| `rm-component-link-icon-inverse-pressed` | `#a3202b` | `#e95d68` | **SWAP** |
| `rm-component-link-icon-primary-pressed` | `#e95d68` | `#a3202b` | **SWAP** |
| `rm-component-link-icon-primaryOnDark-pressed` | `#e95d68` | `#e95d68` | **SWAP** |
| `rm-component-link-text-inverse-pressed` | `#a3202b` | `#e95d68` | **SWAP** |
| `rm-component-link-text-primary-pressed` | `#e95d68` | `#a3202b` | **SWAP** |
| `rm-component-link-text-primaryOnDark-pressed` | `#e95d68` | `#e95d68` | **SWAP** |
| `rm-component-notification-border-warning` | `#eaab3e` | `#eaab3e` |  |
| `rm-component-notification-icon-success` | `#0b5e36` | `#0c783e` |  |
| `rm-component-paymentHistory-30days` | `#ff9124` | `#ff9124` |  |
| `rm-component-paymentHistory-60days` | `#db6600` | `#db6600` |  |
| `rm-component-paymentHistory-90days` | `#c12a36` | `#c12a36` | **SWAP** |
| `rm-component-paymentHistory-good` | `#0b5e36` | `#0c783e` |  |
| `rm-component-progressBar-fill-primary` | `#ffffff` | `#111111` |  |
| `rm-component-progressBar-fill-warning` | `#db6600` | `#db6600` |  |
| `rm-component-screenFooter-fill-primary` | `#1b1b1b` | `#ffffff` |  |
| `rm-component-screenFooter-fill-secondary` | `#1b1b1b` | `#f7f7f7` |  |
| `rm-component-screenFooter-fill-tertiary` | `#2b2b2b` | `#ffffff` |  |
| `rm-component-screenLoader-scrim` | `rgba(0, 0, 0, 0.8)` | `rgba(255, 255, 255, 0.6)` |  |
| `rm-component-screenNavigation-fill-primary` | `#1b1b1b` | `#ffffff` |  |
| `rm-component-screenNavigation-fill-secondary` | `#1b1b1b` | `#f7f7f7` |  |
| `rm-component-screenNavigation-fill-tertiary` | `#2b2b2b` | `#ffffff` |  |
| `rm-component-sectionHeader-fill-info` | `#2a396f` | `#edf1ff` |  |
| `rm-component-sectionHeader-fill-metricWarning` | `#af4b04` | `#fef1e6` |  |
| `rm-component-sectionHeader-fill-primary` | `#404040` | `#f2f2f2` |  |
| `rm-component-sectionHeader-fill-primaryOnDark` | `#545454` | `#545454` |  |
| `rm-component-sectionHeader-fill-success` | `#0b5e36` | `#e7f3ed` |  |
| `rm-component-sectionHeader-fill-systemWarning` | `#845710` | `#fff5e4` |  |
| `rm-component-sectionHeader-icon-info` | `rgba(255, 255, 255, 0.8)` | `#4156a1` |  |
| `rm-component-sectionHeader-icon-metricWarning` | `rgba(255, 255, 255, 0.8)` | `#b55003` |  |
| `rm-component-sectionHeader-icon-success` | `rgba(255, 255, 255, 0.8)` | `#0c783e` |  |
| `rm-component-sectionHeader-icon-systemWarning` | `rgba(255, 255, 255, 0.8)` | `#986717` |  |
| `rm-component-sectionHeader-text-description` | `rgba(255, 255, 255, 0.8)` | `#545454` |  |
| `rm-component-sectionHeader-text-info` | `#ffffff` | `#4156a1` |  |
| `rm-component-sectionHeader-text-metricWarning` | `#ffffff` | `#b55003` |  |
| `rm-component-sectionHeader-text-premium-subtle` | `#f2f2f2` | `#f2f2f2` |  |
| `rm-component-sectionHeader-text-success` | `#ffffff` | `#0c783e` |  |
| `rm-component-sectionHeader-text-systemWarning` | `#ffffff` | `#111111` |  |
| `rm-component-sheet-ripple-android` | `rgba(255, 255, 255, 0.1)` | `rgba(0, 0, 0, 0.1)` |  |
| `rm-component-skeletonLoader-default` | `rgba(255, 255, 255, 0.1)` | `#f2f2f2` |  |
| `rm-component-slider-fill-knob-disabled` | `#c1c1c1` | `#c1c1c1` |  |
| `rm-component-slider-fill-track` | `#7b7b7b` | `#c1c1c1` |  |
| `rm-component-spinner-fill-secondary` | `#111111` | `#ffffff` |  |
| `rm-component-spinner-fill-warning` | `#a06c17` | `#a06c17` |  |
| `rm-component-switch-fill-track` | `#545454` | `#c1c1c1` |  |
| `rm-component-tabBar-border` | `#545454` | `#ffffff` |  |
| `rm-component-tabBar-border-selected` | `#ffffff` | `#de3341` | **SWAP** |
| `rm-component-tabBar-icon-selected` | `#ffffff` | `#de3341` | **SWAP** |
| `rm-component-tabBar-text-selected` | `#ffffff` | `#de3341` | **SWAP** |
| `rm-utility-confetti-primary` | `#c8102e` | `#c8102e` |  |
| `rm-utility-confetti-secondary` | `#aa80e7` | `#aa80e7` |  |
| `rm-utility-confetti-tertiary` | `#5b3c9c` | `#5b3c9c` |  |
| `rm-utility-gradient-alwaysSunbeam-end` | `#de3341` | `#de3341` | **SWAP** |
| `rm-utility-gradient-alwaysSunbeam-start` | `#a42663` | `#a42663` |  |
| `rm-utility-gradient-overflow-transparent` | `rgba(17, 17, 17, 0)` | `rgba(255, 255, 255, 0)` |  |
| `rm-utility-shadow-card-3` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.03)` |  |
| `rm-utility-shadow-shadow-01` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.04)` |  |
| `rm-utility-shadow-shadow-02` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.05)` |  |
| `rm-utility-shadow-shadow-03` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.06)` |  |
| `rm-utility-shadow-shadow-04` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.12)` |  |
| `rm-utility-shadow-shadow-06` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.16)` |  |
| `rm-utility-shadow-shadow-08` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.2)` |  |
| `rm-utility-shadow-shadow-12` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.24)` |  |
| `rm-utility-shadow-shadow-16` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.3)` |  |
| `rm-utility-shadow-shadow-24` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0.4)` |  |
| `rm-utility-transactionDetail-baseColor` | `#1b1b1b` | `#ffffff` |  |
| `rm-experimental-fill-premium` | `#2c334b` | `#edf1ff` |  |
| `rm-experimental-gradient-premium-end` | `#b9c7f6` | `#b9c7f6` |  |
| `rm-experimental-gradient-premium-start` | `#edf1ff` | `#edf1ff` |  |
| `rm-experimental-surface-premium` | `#080e23` | `#edf1ff` |  |
