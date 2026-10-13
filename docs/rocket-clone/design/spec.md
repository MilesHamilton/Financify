# Daily Spend + polished components: implementation spec

**TL;DR.** This spec covers four Daily Spend frames, a hero-state board and a before/after board for every item in `polish-gaps.md` (#0–#16). The designs live in `docs/rocket-clone/financify.pen` and the PNG exports sit next to this file. The daily allowance ("You can spend **$52** today") is the hero. Per-day bars highlight today, chips carry state colour, and a "Savings goal → Adjust" path opens a sheet with a live allowance preview. A streak of on-track days and a "super saver" glow add delight.

The data shape and formulas come from `rm-daily-spend.md` §4–§5 (`GET /api/mobile/daily-spend`). Every colour below is a `colors.*` name from `mobile/src/constants/theme.ts`, and every type style is a `type.*` name. New tokens are listed in §0.

| Frame (Pencil name) | PNG |
|---|---|
| Daily Spend – Spending tab | `daily-spend-spending-tab.png` |
| Daily Spend – Dashboard card | `daily-spend-dashboard-card.png` |
| Daily Spend – Day detail sheet | `daily-spend-day-detail-sheet.png` |
| Daily Spend – Set savings goal sheet | `daily-spend-set-savings-goal-sheet.png` |
| Daily Spend – Hero states (8 states of the hero card) | `daily-spend-hero-states.png` |
| Components – Polished (before → after, #0–#16) | `components-polished.png` |

Canvas notes:
- Frames are 402×874 at @1x. PNGs are @2x; the board is @1.5x.
- Pencil renders with Inter as a stand-in. Ship the system font (SF Pro) at the same sizes and weights through `type.*`.
- The reusable `Status Bar` and `Tab Bar` components sit above the frames on the canvas.
- Mock scenario: Tue Oct 13 2026, 31-day month, 19 days left (today included). Income $5,200, bills $2,850, goal $800, so the flexible budget F = $1,550. Spent through Oct 12 is $560, today's start-of-day allowance is $52, $18 has been spent today, and tomorrow's allowance is $54.

---

## 0. Tokens

All of these already exist in theme.ts: `bg card cardSubtle accentFill border divider text textSubtle textIgnored textDisabled textInverse brand brandText success successFill warning warningFill info infoFill chartLine chartAxis track skeleton tabBar tabBarBorder tabInactive`. They are also defined as Pencil variables with the same names.

**New tokens. Add these to `colors`:**

| Token | Value | Use |
|---|---|---|
| `progressWarning` | `#DB6600` | Progress fill when over 100 % (RM literal) |
| `chipSuccessBg` / `chipSuccessFg` | `#B5DDC6` / `#0B5E36` | Success chip |
| `chipWarningBg` / `chipWarningFg` | `#FFE6CC` / `#C25400` | Warning chip |
| `cardPressed` | `rgba(0,0,0,0.1)` | Overlay on a pressed tappable card |
| `rowPressed` | `rgba(255,255,255,0.06)` | Pressed row band. This is the only token not taken from RM; polish-gaps #11 recommends this value |
| `borderTranslucent` | `rgba(255,255,255,0.4)` | Underline-tabs hairline |
| `dragHandle` | `#545454` | Sheet grabber |

**Token fix:** change `tabBarBorder` from `#4D4D4D` to `#545454`.

There are no other new colours, with two exceptions. The category avatar colours use the existing category palette. The super-saver glow uses `successFill` at 60 % alpha (`#0B5E3699`).

Other values used throughout:
- Radii: `radius.sm` 6 (skeleton bars), `radius.banner` 8 (inline notes), `radius.md` 16 (cards), `radius.lg` 24 (sheet top), `radius.round`.
- Gutter: `space(4)` = 16.
- Money: always `fontVariant: ['tabular-nums']`.

---

## 1. Shared building blocks

| Component | Spec |
|---|---|
| **Money** | `Money({ value, size: 'xxl'|'xl'|'l', cents?: boolean, suffix?: string, color? })`. Dollars use `type.headingXXL` (48/56, 500, −1) or XL/L, with tabular-nums. Cents (when `cents` is true and the value is not whole) use `type.headingXS` (20/28, 500) in `textSubtle`, in a wrapper with `marginTop: 4, marginLeft: 2`, `alignItems: 'flex-start'`. A suffix (e.g. "today", "/mo", "for today", "left") uses `type.headingXS` in `textIgnored`, `marginLeft: 6`, aligned to the bottom (`alignItems: 'flex-end'` on the row, `paddingBottom: 6` on the suffix). Allowance values are always whole dollars (`cents={false}`). |
| **Chip** | Height 28, `paddingHorizontal: 10`, gap 4, `radius.round`, 16 px icon, `type.labelS` (14/20, 500). Variants as bg/fg: success `chipSuccessBg`/`chipSuccessFg`; warning `chipWarningBg`/`chipWarningFg`; secondary `track`/`text`; primary `text`/`textInverse`. |
| **ProgressBar** | Height 6, a row with gap 2. The fill has radii `[3,0,0,3]` and colour `text`. The track is `flex: 1`, radii `[0,3,3,0]`, colour `track`. **Over mode:** the fill shows the allowance share (allowance ÷ spent × width) in `text`, and the remainder uses `progressWarning`. When the whole month is over, a single bar in `progressWarning` with radius 3. Width animates from 0 to target over 600 ms with `Easing.out(Easing.cubic)`. Set `accessibilityRole="progressbar"` with `accessibilityValue {min:0,max:100,now}`. |
| **Card** | `colors.card`, `radius.md`, padding 20 for hero cards and 16 for list and chart cards, gap 12. When tappable, add a `cardPressed` overlay on press. |
| **Sheet** | `presentation: 'formSheet'`, `sheetGrabberVisible`, top radius 24, fill `card`. Grabber is 36×5, radius 3, `dragHandle`, 8 px from the top. Scrim is `rgba(0,0,0,0.65)`. Content padding is 16 horizontal and the gap is 16–20. Each sheet's detents are listed in its section below. |
| **Status Bar / Tab Bar** | See §8 #0. |

---

## 2. Frame: Daily Spend – Spending tab

The route is `app/(tabs)/spending.tsx`, which gets a new **Daily** tab. The layout is a vertical ScrollView on `bg`.

1. **Header** (padding `4 16 12 16`, `space-between`, centred):
   - "Spending" in `type.heading` (28/36, 500, −1).
   - **Month pill** (compact header variant of #15): height 36, `radius.round`, fill `card`, padding `0 6 0 12`, gap 6. It holds a `calendar-days` icon (16, `textSubtle`), "October" in `type.labelS`, and a `chevron-down` (16). Tapping it opens the month picker.
2. **Underline tabs** (#3): "Overview · **Daily** · Breakdown".
   - Row padding `0 16`, gap 24. Each tab has `paddingTop: 6`, `type.label` (16/24), gap 8 to the underline.
   - The selected tab is `text` with a 2 px `text` underline as wide as the label. Others are `textIgnored`.
   - A full-width 1 px `borderTranslucent` hairline sits underneath.
   - The selection persists per session.
3. **Content** padding 16, gap 12:

**3a. Allowance hero card** (Card, padding 20, gap 12). The default state is on_track; see §6 for the others.

| Part | Spec | Copy |
|---|---|---|
| Top row | `space-between`. Label in `type.labelS` `textSubtle`. Chip success with `circle-check` | "You can spend" · "On track" |
| Hero | Money xxl `$52` plus suffix "today" | `today.allowance` |
| Progress labels | Row `space-between`. Left `type.labelS` `text`, right `type.labelS` `textSubtle` | "$18 spent" · "$34 left" (`today.spent`, `today.left`) |
| ProgressBar | Fill = spent ÷ allowance | |
| Body | `type.paragraph` (14/20) `textSubtle` | "Stay under {left} today and tomorrow's allowance rises to {tomorrowAllowance}." Show the second clause only when `tomorrowAllowance > allowance`. Otherwise use "Stay under {left} today to keep tomorrow at {tomorrowAllowance}." |
| Divider | 1 px `divider` | |
| Footer | Row `space-between`. Left: `flame` icon (16, `warning`) with gap 6 and `type.labelS` `text`. Right: `type.caption` `textIgnored` | "{n}-day on-track streak" · "{daysRemaining} days left" |

**Streak (client-derived):** count consecutive days before today where `spent ≤ allowance`, walking back from yesterday. Hide the streak when n < 2, and show "Streak paused" (icon `textDisabled`, text `textIgnored`) instead. When n is a new personal best, the copy is "{n}-day streak · personal best". Store the best value in SecureStore, which is optional.

**3b. Spend per day card** (Card, padding `16 16 12 16`, gap 12):
- **Header:** "Spend per day" in `type.label`, and "Avg ${averagePerDay}/day" in `type.caption` `textIgnored`. Use the 30-day average.
- **Chart row:**
  - The plot is 112 high and fills the width, with an 8 px gap before a 32 px Y gutter.
  - **One bar per calendar day** (31 bars) with gap 3 and top radius 3. Each bar's height is `value / yMax × 112`.
  - `yMax = max(max spent, max allowance)` rounded up to a multiple of 10. Ticks are `[yMax, floor(yMax/2), 0]`, right-aligned in `type.captionS` (10/15) `textSubtle`, formatted with `moneyCompact`. The gutter is laid out `space-between`.
  - Past day with `spent ≤ allowance`: `chartLine`.
  - Past day with `spent > allowance`: `warning`.
  - Past day with spent = 0: a 2 px stub in `track`.
  - **Today:** a bar as tall as `allowance` with fill `rgba(59,130,246,0.2)` and a 1.5 px `brand` stroke, plus an inner bottom-aligned bar for `spent` in `brand`.
  - **Future days:** ghost bars as tall as their projected `allowance` in `rgba(255,255,255,0.06)`.
  - **Allowance line:** 1 px `border` drawn at today's allowance. In code use a stepped polyline through each day's `allowance`, with `strokeDasharray 4 4`.
- **X labels** sit 12 px below the plot in `type.captionS` `textSubtle`: "Oct 1" left-aligned at bar 1, "Today" in `brandText` weight 500 centred under today's bar, and "Oct 31" right-aligned at the last bar.
- **Legend:** row gap 14, 8×8 radius 2 swatches, `type.caption` `textSubtle`: "Under", "Over", "Today", and a 12×1 line labelled "${allowance}/day allowance".
- **Interactions:**
  - **Press-and-scrub** (#8). The selected bar is at 100 % and the others at 40 %. A tooltip pill shows "Oct 9 · $46", and the header swaps to "Fri, Oct 9" / "$46.00 · under by $6" (or "over by $X"). Fire `selectionAsync` on each index change.
  - **Tap a bar** to open the **Day detail sheet** for that date. Future bars are not tappable.
  - a11y: each bar is labelled "Tue Oct 6, spent $74.18, allowance $53, over". The chart wrapper's summary is "Spent $560 so far this month, $52 allowance today".

**3c. Savings goal row** (Card, padding `14 16`, gap 12, centred, tappable as a whole card with the `cardPressed` overlay):
- A 36 px round `accentFill` disc holding a `piggy-bank` icon (20, `text`).
- Text column: "Savings goal · $800/mo" in `type.label`, then "On pace to save ${projectedSavings} ({percentOfTarget}%)" in `type.caption`. The caption colour is `success` for super_saver and on_track, `warning` for at_risk and over_budget.
- An **Adjust** button: height 32, `radius.round`, fill `track`, padding-x 14, `type.labelS` `text`.
- Pressing the button or the row opens the **Set savings goal sheet**.

4. **Tab bar**, with Spending active (#0).

**Loading:** show skeleton hero state 8 (§6) plus a skeleton chart card: a 96×24 heading bar, then 31 bars of random 20–80 px height in `skeleton`, all pulsing.

**Pull to refresh:** refetch, then fire `selectionAsync` on completion.

---

## 3. Frame: Daily Spend – Dashboard card

This is page 1 of `SpendCarousel` on the dashboard. The existing spend chart moves to page 2. Header and accounts are unchanged except for the polish items.

**Daily Spend card** (Card, padding 20, gap 16, whole card tappable, navigates to Spending → Daily):

| Part | Spec | Copy |
|---|---|---|
| Top row | Label `type.labelS` `textSubtle`. **Streak chip:** secondary variant with `flame` icon in `warning`. Hidden when the streak < 2; then show the state chip from §6 instead | "Today you can spend" · "5 days" |
| Money row | Row `space-between`, aligned to the end. Left: Money xxl "$52" with no suffix. Right column, right-aligned, gap 2, `paddingBottom: 8`: "$34 left" in `type.label` `success` (over: "$12 over" in `warning`), then "$18 spent so far" in `type.caption` `textIgnored` | |
| **Week strip** | 7 columns Mon–Sun of the current week, `space-between`, each 36 wide, gap 6. Weekday initial in `type.caption`: `textIgnored`, or `text` weight 600 for today. Each day has a 32 px circle (states below) | |
| Divider | 1 px `divider` | |
| Footer | "Right on plan · 19 days left" in `type.caption` `textSubtle` (the status title from §6 · days left). "See daily ›" in `type.labelS` `text` with a 16 px chevron | |

Week strip circles:
- **under:** filled `successFill` with a `check` icon (16, `success`).
- **over:** filled `warningFill` with a `minus` icon (16, `text`).
- **no spend:** filled `successFill`, same as under.
- **today:** a progress ring 32 px, stroke 3. The track is `track`; the arc is `brand` with sweep = spent ÷ allowance × 360, starting at 12 o'clock and going clockwise. It turns `warning` when over. The date sits in the centre in `type.caption` weight 600.
- **future:** a 1 px `divider` outline with the date in `type.caption` `textDisabled`.
- **Days in another month:** render empty (no circle).

**Pagination** (#14): three dots, page 1 active. Accounts use the section header and card rows unchanged, with polish #11/#12 applied.

**Motion:**
- On first mount each day, the hero number counts up from 0 to the allowance over 500 ms (ease-out). Skip this when Reduce Motion is on.
- The today ring animates its sweep over 600 ms.

---

## 4. Frame: Daily Spend – Day detail sheet

This opens on tapping a past or today bar on the Spending tab, or a week-strip circle on the dashboard. It is a form sheet with detents `[0.7, large]` and starts at 0.7. The example shown is the over state (Tue Oct 6, $74.18 against $53).

1. **Grabber.**
2. **Header** (padding-x 16, `space-between`):
   - Day nav: a 32 px round `track` Prev button with `chevron-left` 18, then the title "Tue, Oct 6" in `type.headingXS` (20/28), then a matching Next button. Prev and Next step one day, are disabled at the month edges, and fire `selectionAsync`.
   - State chip on the right:
     - over: warning chip with `trending-up`, "Over by ${spent − allowance}" (whole dollars).
     - under: success chip with `circle-check`, "Under by ${allowance − spent}".
     - today: secondary chip with `clock`, "Today".
3. **Summary** (padding-x 16, gap 10):
   - Row: Money xxl **with cents** ($74 + `.18` in `textSubtle`), and "of $53 allowance" in `type.paragraph` `textSubtle`, right-aligned at the bottom.
   - Then the ProgressBar. Over mode is shown: fill width = allowance ÷ spent, overage in `progressWarning`.
4. **Roll-forward note** (padding-x 16): fill `cardSubtle`, `radius.banner` (8), padding 12, gap 10, an `info` icon (18, `info`), and `type.paragraph` `textSubtle`. Copy:
   - over: "No stress — the extra ${over} was spread over the rest of {Month}, so each later day dropped by about ${round(over / daysAfter)}."
   - under: "Nice — the ${under} you didn't spend was spread over the rest of {Month}, adding about ${…} to each later day."
   - Today: hide the note.
   - When the rounded per-day effect is less than $1, say "by a few cents".
5. **Section header band** (#9): full bleed, `accentFill`, padding 8×20. "{n} transactions" in `type.labelS` on the left; the day total in `type.caption` `rgba(255,255,255,0.8)` on the right.
6. **Rows** (padding-x 16): height 60, gap 12.
   - Avatar 36 round (#12: logo, falling back to CategoryIcon with a white 18 glyph on the category colour).
   - Merchant in `type.label`, category in `type.caption` `textIgnored`.
   - Amount in `type.label` with tabular-nums.
   - Pressed state is `rowPressed`, full bleed. Tapping opens the transaction detail.
   - Only flexible spend appears here (bills and excluded transactions are filtered out, as in the API).
7. **Footer:** a secondary button (height 48, `radius.round`, fill `track`, `type.label`) labelled "View in Transactions". It goes to the Transactions tab filtered to that date.
8. **Empty day:** EmptyState (#13) with `coffee` icon, "No spending on {Tue, Oct 4}", body "Nothing counted toward your allowance this day." and no action.

---

## 5. Frame: Daily Spend – Set savings goal sheet

This opens from "Adjust" (Spending tab), from the over_budget footer link, or from Settings. It is a form sheet, `large` detent, keyboard-free.

1. **Grabber.**
2. **Header:** "Monthly savings goal" in `type.headingXS`, and a Close button (32 round `track`, `x` 18).
3. **Value stepper** (`space-between`):
   - Minus and plus buttons: 44 round, 1 px `border` stroke, icon 20. They step by $50 and fire `selectionAsync`. Long-press repeats every 120 ms after 400 ms.
   - Centre column: Money xxl `$900` with suffix "/mo", then "was $800" in `type.caption` `textIgnored`. Hide "was" when the value is unchanged.
4. **Slider:**
   - Track 6 px in `track` with radius 3; fill in `text`. Thumb is 28 px `text` with shadow `0 2 6 rgba(0,0,0,0.4)`.
   - Range is $0 to **max = income − billsReserved** (`plan.income − max(billsExpected, billsPaid)`), snapping to $50.
   - Fire `selectionAsync` at each snap step.
   - Scale labels "$0" and "${max} max" in `type.caption` `textIgnored`.
5. **Presets:** 4 equal-width chips, height 36. Selected is the primary variant (`text`/`textInverse`); others are `track`/`text`. Values are $500, the current goal, round(max × 0.4 / 50) × 50, and round(max × 0.5 / 50) × 50, deduplicated and sorted.
6. **Impact card:** fill `infoFill`, `radius.md`, padding 16, gap 8.
   - Row: "Daily allowance" in `type.labelS` `info`. On the right, the old value in `type.label` `textIgnored` with strikethrough, an `arrow-right` (16, `info`), and the new value in `type.headingXS` `text`, e.g. "$46/day".
   - Body in `type.paragraph` `info`: "Saving ${Δ} more means about ${Δ/day} less to spend each day for the {N} days left." (or "Saving ${Δ} less gives you about ${Δ/day} more each day…").
   - New allowance = `max(0, floor((F' − C(t−1)) / daysRemaining))`, where F' = I − S' − R. Compute it on the client from the response.
   - The new value **crossfades** on change (150 ms).
   - **Infeasible** (S' > max): the card switches to `warningFill` with body "That leaves nothing for day-to-day spending this month." and Save stays enabled.
7. **Plan breakdown** (rows of `type.labelS` `textSubtle` with values on the right):
   - Income: "$5,200" with sub-caption "Avg of last 3 months · Edit" (or "Set manually · Edit"). "Edit" opens the income override in Settings.
   - Bills & subscriptions: "−$2,850".
   - Savings goal: "−$900" in `brandText`.
   - A 1 px `divider` top border, then **Flexible spending** in `type.label` `text`, with "$1,450" in `success` (`warning` when ≤ 0). Rows are 40 high; the income row is 52.
8. **Primary button** "Save goal": height 52, `radius.round`, fill `brand`, `type.label` `text`. Pressed fill is `brandPressed`. Disabled when unchanged (fill `accentFill`, label `textDisabled`).
   - On save: `PUT /api/settings { monthly_savings_target }`, fire `notificationAsync(Success)`, dismiss, invalidate `daily-spend`, and show a toast "Goal updated · ${allowance}/day".
   - On error: an inline `type.caption` `warning` line above the button: "Couldn't save. Try again."

---

## 6. Hero card states (`daily-spend-hero-states.png`)

The same card and layout as §2 3a; only the content changes. Choose the state in this order: `no_income` → `over_budget` → **over today** (`today.left < 0`) → `at_risk` → `on_track` / `super_saver`. **Last day** (`daysRemaining === 1`) only changes the copy.

| # | State | Label | Chip | Hero | Progress / labels | Body | Footer |
|---|---|---|---|---|---|---|---|
| 1 | super_saver | You can spend | success · `sparkles` · "Ahead" | $61 today | normal | "You're ahead of plan. Keep it under ${X} a day and you'll beat your goal by ${projected − target}." | streak (personal best wording) |
| 2 | on_track | You can spend | success · `circle-check` · "On track" | $52 today | normal | "Stay under ${left} today and tomorrow's allowance rises to ${tomorrow}." | streak |
| 3 | at_risk | You can spend | warning · `triangle-alert` · "At risk" | $38 today | normal | "Ease off a little. Keep to ${X} a day for the rest of the month to still hit your goal." | "Streak paused" (dimmed) |
| 4 | over today | Today's allowance | warning · `trending-up` · "Over today" | $52 today | over mode; right label "${−left} over" in `warning` | "You're ${over} over today. Tomorrow adjusts to ${tomorrow}, so there's no need to make it up all at once." | "Streak resets tomorrow" (dimmed) |
| 5 | over_budget | Spending money left | warning · `circle-alert` · "Over plan" | **$0** in `textSubtle`, suffix "left" | single full `progressWarning` bar; labels "${todaySpent} spent today" / "${overBy} over plan" in `warning` | "You've used this month's spending money, so new spend comes out of savings." | `sliders-horizontal` icon + "Adjust savings goal" (tappable, opens §5) |
| 6 | last day | Last day of {Month} | per status | $38 **for today** | normal | "Finish under ${X} and you'll save ${projected} this month." | right caption "Last day" |
| 7 | no_income | — | — | — | — | Centred empty layout (padding `28 20`): 48 `accentFill` disc with `calendar-check` 24 `textSubtle`; "Unlock your daily allowance" in `type.headingXXS`; "Add your monthly income and we'll work out how much you can spend each day." in `type.paragraph` `textSubtle`, max-width 280, centred; primary-on-dark button "Set monthly income" (height 40, `text` fill, `textInverse` label) opening Settings → income | — |
| 8 | loading | skeleton | 84×28 round | 120×48 | full-width 6 px bar | 2 bars (full, 200) × 16 | 160×16 · 64×16 |

When `plan.isFeasible` is false, state 5 uses the body "Your savings goal is higher than your income after bills." and the footer reads "Lower your goal".

**Celebrate (state 1):**
- The card gets a second background layer: a radial gradient centred at top-right (85 %, 0) from `rgba(11,94,54,0.6)` to transparent, in an ellipse 1.6 × card width by 1.2 × card height. Use `react-native-svg` `RadialGradient` behind the content.
- The first time each day that the status becomes super_saver: fire `notificationAsync(Success)`, scale the chip from 0.9 to 1 with a spring, and run a one-shot **sparkle burst**. The burst is 8 four-point sparkles in `success` and `brandBold` that move 24–40 px outward from the chip, fading 1 → 0 over 700 ms with `useNativeDriver`.
- No Lottie. Respect Reduce Motion, which keeps only the static glow.

**Over transitions:** when a refetch flips a state from on_track to over today, crossfade the chip (200 ms) and animate the bar into over mode (300 ms). No haptic, because this is a passive update.

---

## 7. Copy table (server `copy` field overrides when present)

| Key | Copy |
|---|---|
| chip | Ahead · On track · At risk · Over today · Over plan |
| title (footer status on the dashboard) | You're ahead of plan · Right on plan · Ease off a little · Over today · Over your plan · Set your income |
| allowance a11y | "You can spend {X} today. {spent} spent, {left} left." |
| last-day chip (secondary, used on Overview) | "{X} for today" (otherwise "{X}/day for {N}d") |

---

## 8. Polished components (`components-polished.png`)

Each item matches the board row with the same number. "Before" is today's build and "After" is the target.

| # | Item | After: exact spec | Interaction / motion / haptics |
|---|---|---|---|
| 0 | **Tab bar** | Height 52 for items plus the safe area. Fill `tabBar`, 1 px top border `tabBarBorder` (#545454). 5 equal items, each a column with gap 3: a 24×3 indicator with radius `[0,0,3,3]` (`brand` when selected, transparent otherwise), a 24 px Lucide icon, and a label at 10 px weight 500. Selected icon and label are `brand`; inactive are `tabInactive` | `selectionAsync` on change. Hides with translateY when bulk editing: 200 ms out, 250 ms in |
| 1 | **Money typography** | See Money (§1). Hero numbers: dashboard spend, Spending total, net worth, transaction detail. List values get tabular-nums | When the value changes: count up 400 ms on numbers ≥ $1 (hero only) |
| 2 | **Segmented (in-card)** | Track height 40, `cardSubtle`, 1 px `card` border, padding 4, `radius.round`. Segments flex 1. Selected pill uses `text` fill with label `type.labelS` `textInverse`; unselected label `textSubtle` | Pill slides with `Animated.spring` on translateX (native driver), measured from onLayout. `selectionAsync` |
| 3 | **Underline tabs (screen)** | Row gap 24, padding-x 16. Label `type.label`, selected `text`, others `textIgnored`. 2 px `text` underline as wide as the label, 8 below. Full-bleed 1 px `borderTranslucent` | Underline animates translateX and width with a 220 ms timing. `selectionAsync`. Used for Recurring (Upcoming/All), Net worth (Summary/Assets/Debt), Spending (Overview/Daily/Breakdown) |
| 4 | **Progress bar** | See ProgressBar (§1). Category row: label and value in `type.label`, bar 8 below | Width 0 → pct, 600 ms ease-out cubic, on mount and on change |
| 5 | **Chips** | See Chip (§1). Replace the SpendCarousel badge with `<Chip variant={below?'success':'warning'} icon={below?'trending-down':'trending-up'} label="$98 below last month"/>` | None |
| 6 | **Chart axes** | Y ticks `[max, floor(max/2), 0]` in a right gutter 36 wide, `type.captionS` `textSubtle`, `moneyCompact`. X labels `type.captionS` `textSubtle`, 10 px below, centred per bar or at 1 / mid / last for line charts. Reference line 1 px `border`, `strokeDasharray "4 4"`. Bars have top radius 3 only (use a `Path`) and gap 14 for 7-bar charts. BUDGET label uses `type.tracked` with no font-size override. a11y summary on the wrapper | None |
| 7 | **Haptics** | Segment, tab, month arrow, picker option → `selectionAsync`. Chart scrub index → `selectionAsync`. Slider snap → `selectionAsync`. Switch or accordion → `impactAsync(Light)` on pressIn. Save goal, category change, note save → `notificationAsync(Success)`. First super_saver of the day → `notificationAsync(Success)` | Never on scroll or passive refetch |
| 8 | **Scrub + tooltip** | Card header kicker `type.caption` `textSubtle` and value `type.headingXS`; on scrub they become the date and the value. Line charts: 1 px `chartAxis` vertical rule plus an r=5 `text` dot. Bar charts: selected bar at opacity 1, others 0.4. Tooltip pill: height 26, `radius.round`, fill `text`, `type.caption` weight 500 `textInverse`, padding-x 12, 4 px above the plot top, clamped inside the card. Copy: "Oct 9 · $46" | PanResponder with `onStartShouldSetPanResponder → true`; locationX → index. `selectionAsync` per index. Parent scroll disabled while active. Release fades the tooltip out over 150 ms and reverts the header |
| 9 | **Section header band** | Full bleed (marginH −16, padding `8 20`), fill `accentFill`. Left `type.labelS` `text`; right `type.caption` `rgba(255,255,255,0.8)`. `accessibilityRole="header"`, sticky. Tone variants: `successFill`, `#AF4B04` (literal RM metricWarning), `infoFill` | None |
| 10 | **Skeletons** | Fill `skeleton`, bars radius 6, avatar circles. Row: 32 circle, gap 16, a 60 % × 19 bar and a 35 % × 12 bar (gap 6), and a 46×21 trailing bar. Card padding `24 20`, gap 16, heading 96×24. One loop drives all: opacity 0.5 ↔ 1, 700 ms each way, native driver | None |
| 11 | **Cards & rows press** | Row height 52 (accounts) or 56–60 (transactions), padding-x 16, gap 12. Pressed row gets the `rowPressed` band spanning the card edge to edge; content stays at 100 % opacity. Tappable card gets the `cardPressed` overlay. Remove all `opacity: 0.7` | Instant in, 120 ms fade out |
| 12 | **Logos & avatars** | 36 round. Remote logo `resizeMode="cover"` with a 1 px `rgba(255,255,255,0.12)` ring and a `skeleton` placeholder until onLoad. On error, fall back to `CategoryIcon` (white 18 glyph on the category colour). Letter avatar only for uncategorised recurring, tinted by `hash(name) % 6` into `#149CD6 #3FB24B #5D33D6 #DE7412 #D02462 #1DC1B7` | Logo fades in over 150 ms on load |
| 13 | **Empty states** | Centred, padding-y 32, gap 12. A 48 `accentFill` disc with a 24 glyph in `textSubtle`. Title `type.headingXXS` (18/24). Body `type.paragraph` `textSubtle`, max-width 280, centred. Optional secondary button: height 40, `track`, `type.labelS`. Copy: Upcoming → "Nothing due this week" / "You do not have any recurring charges within the next 7 days." / "See all recurring". Transactions → "No transactions found". Breakdown → "No spending yet" / "Spending shows up here as transactions sync." | None |
| 14 | **Pagination dots** | Dots 7×7 with gap 6. Inactive `track`; active `text` widened to a 16×7 pill | Driven by onScroll (`scrollEventThrottle 16`, `Math.round(x/width)`); width animates over 200 ms |
| 15 | **Month selector** | Full variant: height 48, `radius.round`, fill `card`, padding `0 8 0 16`, gap 8. `calendar-days` 18 `textSubtle`, label `type.label` ("This month · October" / "Last month · September" / "March 2026"), spacer, then two 32×32 chevron buttons (18). A future month is disabled with `textDisabled`. Compact header variant: see §2 | `selectionAsync` on change |
| 16 | **Transitions** | Accordion: call `LayoutAnimation.configureNext(LayoutAnimation.create(220,'easeInEaseOut','opacity'))` before setOpen; a single chevron rotates 0 → 90° (Animated, 220 ms). Child rows are 44 high, indented 16, `type.paragraph` `textSubtle`. Sheets: formSheet, grabber, top radius 24, detents per sheet | `impactAsync(Light)` on accordion pressIn |

---

## 9. Implementation order (suggested)

1. Tokens (§0) plus Money, Chip, ProgressBar.
2. Segmented and underline tabs.
3. Daily tab: hero card and states.
4. Per-day chart with scrub.
5. Day sheet.
6. Goal sheet.
7. Dashboard card.
8. Remaining polish rows.

Not designed: light mode, the Safe-to-Spend mode, and the past-month view. For the past-month view, reuse the chart and replace the hero with the RM past-month verdict chip: Under Budget / Right on Budget / Slightly Over Plan / Over Budget.
