# UI polish gaps: Financify vs. Rocket Money

**TL;DR.** This is a list of 16 concrete changes, ranked by visual impact per unit of effort. The biggest gaps are:
1. **Money typography.** RM shows big amounts as whole dollars with small raised cents; we print flat `$1,262`.
2. **Segmented controls.** RM uses a white pill on a bordered track; ours is a saturated blue pill.
3. **Progress bars.** RM's are two-piece, animated and white; ours are a single thin blue bar.
4. **Charts.** We have no axis labels and no press-to-scrub.
5. **Press feedback and haptics.** Ours are inconsistent or missing.

None of this needs a new dependency; it uses `expo-haptics`, `react-native-svg` and RN `Animated`, which are already installed. RM itself uses victory-native with Skia, react-native-haptic-feedback and reanimated. We don't need them.

**Sources.** The token values come from the Hermes token tables (`rm-capture.md` Appendix A, literal). Component dimensions come from object literals in the bytecode (`objs.txt`, with function ids cited). RM's layout props (`p`, `mt`, `ph`…) are in RM grid units. I take **1 unit = 8 px (inferred)**: it matches `HeaderTimePeriodSelector` `height: 56` with `pl: 2`, and the 16 px radii. Our current state comes from reading the source and the simulator screenshots in the scratchpad (`small-spending-low.png` and others).

---

## Ranked list

### 1. Money: superscript cents and tabular figures
- **File:** `mobile/src/components/ui.tsx` (new `Money` component), used in `components/dashboard/SpendCarousel.tsx`, `app/(tabs)/spending.tsx`, `app/net-worth.tsx`; `lib/format.ts`.
- **RM:** `DollarsAndCentsDisplay#53496` sets dollars in **HeadingXXLarge 48/56** and cents in **HeadingXSmall 20/28**, in a `flexDirection: 'row'` box with the cents nudged `pl: 0.25, pt: 0.5`. That makes them small and top-aligned. The bundle also carries `fontVariant` / `'tabular-nums'`, and `formatCurrency({ shorten: 'dollars' })` is used for whole-dollar chips.
- **Ours:** `money(n, true)` renders `$1,262` in `type.headingXL` with no cents and proportional digits, so numbers jitter when they change.
- **Change:** add `Money({ value, size = 'xl' | 'xxl' | 'l' })`.
  - Split `usd.formatToParts` into dollars and cents.
  - Render `<Text style={[type.headingXXL or XL, {fontVariant:['tabular-nums']}]}>{dollars}</Text>` followed by `<Text style={[type.headingXS, {marginTop: 4, marginLeft: 2}]}>{cents}</Text>` inside `flexDirection:'row', alignItems:'flex-start'`.
  - Use it for hero numbers (dashboard current spend, Spending total, net worth, transaction detail amount).
  - Add `fontVariant:['tabular-nums']` to `ListRow`'s value `Text` so amount columns line up.

### 2. Segmented control: white pill on a bordered track
- **File:** `mobile/src/components/ui.tsx` (`Segmented`, `styles.segmented/segment`). Used in `components/spending/BreakdownCard.tsx`, `app/(tabs)/recurring.tsx`, `app/net-worth.tsx`.
- **RM:** `ButtonToggle#36404` has a track with `borderRadius: round`, a **1 px border** `rm-component-buttonToggle-border-primary` (`#2B2B2B` dark), padding `p: 0.5` (4 px), and `overflow: visible`. The selected option uses the primary chip/button fill **`#FFFFFF`** with dark text (`rm-component-chip-fill-primary`, `button-fill-primary-enabled`).
- **Ours:** the selected pill is `colors.brand` (#3B82F6) with `#fff` text on `#242424`, and there is no border. A full-width saturated blue block (see the Categories/Merchants screenshot) is the loudest thing on the Spending screen.
- **Change:**
  - `segmented: { backgroundColor: colors.cardSubtle, borderWidth: 1, borderColor: colors.card, padding: 4, borderRadius: radius.round }`.
  - Selected: `backgroundColor: colors.text`, label `colors.textInverse`. Unselected label: `colors.textSubtle`.
  - Keep blue for the tab bar only.
  - Call `Haptics.selectionAsync()` in `onChange` (see #7).
  - Animate the pill: measure segment widths and slide an absolutely positioned pill with `Animated.spring` (`useNativeDriver: true` on `translateX`).

### 3. Screen-level top tabs should be underline tabs, not pills
- **Files:** `mobile/src/app/(tabs)/recurring.tsx` (Upcoming | All), `mobile/src/app/net-worth.tsx` (Summary | Assets | Debt); add `variant: 'pill' | 'tabs'` to `Segmented` in `components/ui.tsx`.
- **RM:** these are `TabNavigationPrimaryOnDark#45948`: a `MaterialTopTabBar` with a moving underline indicator. Under it is a full-width **1 px hairline `rm-color-border-translucent` = `rgba(255,255,255,0.4)`** (`{height: 1, mt: -0.125}`). Pills (`ButtonToggle`) are kept for in-card toggles and the 1M…ALL range picker.
- **Ours:** the same pill everywhere, so page navigation and in-card filters look identical.
- **Change:** in `variant="tabs"`, render labels as `type.label` (selected `colors.text`, others `colors.textIgnored`). Add a 2 px `colors.text` underline under the selected label, animated `translateX`/`width`. Draw a `StyleSheet.hairlineWidth` rule in `rgba(255,255,255,0.4)` across the full width. There is no track background.

### 4. Progress bar: two-piece, animated, correct colours
- **File:** `mobile/src/components/ui.tsx` (`ProgressBar`, `styles.track`). Used in `components/spending/BreakdownCard.tsx` and `app/spending/budget.tsx`.
- **RM:** `ProgressBar#38050` draws **two segments**:
  - the fill, with round *left* corners (`topLeft/bottomLeft: round`);
  - a small gap (`ml: 0.26` ≈ 2 px);
  - the remaining track, with round *right* corners.

  It is animated with `Animated.timing({ easing, useNativeDriver: false })` and has `accessibilityRole: 'progressbar'` with `accessibilityValue {min:0,max:100,now}`. Fill tokens: **`rm-component-progressBar-fill-primary` `#FFFFFF`** and **`…-fill-warning` `#DB6600`**. Track is `rm-color-fill-track` `rgba(255,255,255,0.15)`. A sibling bar (#9489) uses `height: 6, borderRadius: 10`.
- **Ours:** one rounded track with a blue fill that turns `warningFill` `#C25400` when over. It doesn't animate, has no a11y value and no gap. In the screenshot the over-budget bar is a single flat orange slab.
- **Change:**
  - Use two `View`s in a row: fill width `pct%` with the left radii, then `marginLeft: 2, flex: 1` for the track with the right radii.
  - Fill colour is `colors.text` normally, and **`#DB6600`** (new token `colors.progressWarning`) when `pct > 1`.
  - Animate the width from 0 on mount with `Animated.timing(…, {duration: 600, easing: Easing.out(Easing.cubic)})`.
  - Add `accessibilityRole="progressbar"` and `accessibilityValue={{min:0,max:100,now:Math.round(pct*100)}}`.

### 5. Chips: one component, semantic tokens
- **File:** `mobile/src/components/ui.tsx` (new `Chip`). Use it in `components/dashboard/SpendCarousel.tsx` (the "$98 below last month" badge), `components/spending/BreakdownCard.tsx` ("Left to Spend / Over Budget" captions), and the budget screen's per-day chip.
- **RM:** `Chip#37816` takes props `label, variant, size, logo, iconLeft, iconRight, strikethrough, isSelected`. It has `borderRadius: round`, an 18 px icon, and `LabelSmall` (14/20) or `CaptionRegular` (12/16) text. Variants used by the budget chip (`getChipVariant`) are `successLight` and `metricWarningLight`. Tokens:
  - success: bg `fill-semantic-success-subtle` `#B5DDC6`, icon `chip-icon-successLight` `#0B5E36`
  - warning: bg `fill-semantic-metricWarning-subtle` `#FFE6CC`, icon `#C25400`
  - secondary: `chip-fill-secondary` `rgba(255,255,255,0.15)`
  - primary: `#FFFFFF`

  Example labels: "$42/day for 18d", "On Track", "Super Saver", "At Risk".
- **Ours:** the badges are bare icon + caption text in `colors.success` / `colors.warning` with no container, so they read as loose text.
- **Change:** `Chip({ label, variant: 'success'|'warning'|'secondary'|'primary', icon? })` with height 28, `paddingHorizontal: 10`, radius round, icon 16, `type.labelS`. Text and icon colours are `#0B5E36` on `#B5DDC6` (success) and `#C25400` on `#FFE6CC` (warning). Replace the SpendCarousel badge with `<Chip variant={below ? 'success' : 'warning'} icon={…} label="$98 below last month" />`.

### 6. Chart axes, labels and reference lines
- **Files:** `mobile/src/components/SpendChart.tsx`, `mobile/src/components/recurring/HistoryBarChart.tsx`.
- **RM:** `DailySpendChart#54233` uses a `CartesianChart` with padding `{top: 10, bottom: 30, right: 0}`.
  - Y ticks are `[0, floor(max/2), round(max)]` (`calculateYAxisTicks`), formatted `"$" + n.toLocaleString()` (`formatYAxisTick`).
  - The x-axis has `lineColor: 'transparent'` and `labelOffset: 10`, with labels in `chart-text-labels` `#C1C1C1`.
  - The reference/average line is a 1 px `Line` with `DashPathEffect`. Bars have rounded tops.
  - Every bar gets an `accessibilityLabel` like "Mon, $12.00".
  - Axis token is `chart-border-axis` `#7B7B7B`.
- **Ours:** `SpendChart` has no y or x labels. The BUDGET label overrides the Tracked style to `fontSize: 10`, against the token's 12/12. The prior-month line is `#7B7B7B` dashed 3/5 at 2 px. The chart has no accessible summary.
- **Change:**
  - Add 3 right-aligned y labels (`type.captionS`, `colors.textSubtle`) at `0, max/2, max` using `moneyCompact`, with a 36 px right gutter.
  - Add x labels at day 1, mid-month and the last day ("Oct 1 / 15 / 31"), 10 px below the plot.
  - Draw the budget line as a 1 px dash `4 4` in `colors.border`.
  - Drop the `fontSize: 10` override so the label uses `type.tracked` as is.
  - Add `accessible accessibilityLabel={`Spent ${money(last)} so far, ${budget ? …}`}` on the wrapper.
  - In `HistoryBarChart`, round only the top corners (use a `Path` instead of `Rect rx`).

### 7. Haptics on every discrete selection
- **Files:** `mobile/src/components/ui.tsx` (`Segmented`, `Button`), `components/spending/MonthSelector.tsx`, `components/net-worth/AccountToggleRow.tsx`, `components/dashboard/AccountsCard.tsx`, `components/transactions/PickerSheet.tsx`, `components/SpendChart.tsx` (scrub).
- **RM:** has `useHaptics#48933` worklets that fire **`impactLight`** and **`impactMedium`**, and a `TouchableHaptic#48974` wrapper (`hapticType`, `hapticTrigger` on `onPressIn`). Slider steps fire `impactLight`, and so do `SelectSheet` scroll ticks. The bundle also imports `selectionAsync` / `impactAsync` / `notificationAsync`.
- **Ours:** only `TabBar` calls `Haptics.selectionAsync()`.
- **Change:**
  - `selectionAsync()` for segmented/tab changes, month arrows, picker option taps and each chart scrub index change.
  - `impactAsync(ImpactFeedbackStyle.Light)` for switch toggles (AccountToggleRow) and accordion expand (AccountsCard).
  - `notificationAsync(Success)` after a successful category change or note save.
  - Fire these on `onPressIn` for toggles, which matches RM's `hapticTrigger`.

### 8. Chart press-and-scrub
- **Files:** `mobile/src/components/SpendChart.tsx`, the net-worth chart in `mobile/src/app/net-worth.tsx`, `components/dashboard/SpendCarousel.tsx` (header value).
- **RM:** charts use victory-native `useChartPressState` (`{isActive, matchedIndex, x, y}`) with `applyChartPressPanConfig` / `activateAfterLongPress`. `NetWorthChartHeader` swaps the headline value to the pressed point.
- **Ours:** charts are static.
- **Change:**
  - Wrap the `Svg` in a `View` with `PanResponder` (`onStartShouldSetPanResponder: () => true`). Map `locationX` to a day index.
  - Render a 1 px vertical rule in `colors.chartAxis` plus a white `r=5` dot on the current series.
  - Lift the index through an `onScrub(index | null)` prop so the card header shows "Oct 9 · $812" while active and reverts on release.
  - Haptic `selectionAsync` when the index changes (#7).
  - Set the ScrollView `scrollEnabled={false}` on the carousel while scrubbing so paging doesn't fight the gesture.

### 9. Transaction day headers: filled section band
- **File:** `mobile/src/components/transactions/TransactionList.tsx` (`renderSectionHeader`, `styles.header`).
- **RM:** `SectionHeader#36476` is a full-width band with `justifyContent: 'space-between'` and `ph: 2.5` (20 px). The label is medium weight with `accessibilityRole: 'header'`. The description is right-aligned `CaptionRegular` with `ml: 1.5`, and there is an optional `info` icon. Fill tokens: `sectionHeader-fill-primary` **`#404040`**, plus `…-fill-success` `#0B5E36`, `…-fill-metricWarning` `#AF4B04` and `…-fill-info` `#2A396F`. Description text is `rgba(255,255,255,0.8)`.
- **Ours:** grey text on the page background. When sticky, rows slide under a transparent-looking header with no separation.
- **Change:**
  - `header: { backgroundColor: colors.accentFill, marginHorizontal: -space(4), paddingHorizontal: 20, paddingVertical: space(2), marginTop: space(3) }`.
  - Left: `type.labelS` in `colors.text`. Right: `type.caption` in `rgba(255,255,255,0.8)`.
  - Add `accessibilityRole="header"`.
  - Let the parent `contentContainerStyle` horizontal padding stay. The negative margin makes the band full-bleed.

### 10. Skeletons that match the content, with a pulse
- **Files:** `mobile/src/components/ui.tsx` (`Skeleton`, new `SkeletonRow`), `app/(tabs)/spending.tsx`, `app/(tabs)/recurring.tsx`, `app/net-worth.tsx`, `app/settings.tsx`, `app/(tabs)/transactions.tsx`, `app/(tabs)/index.tsx`.
- **RM:** shape-specific skeletons (`SkeletonContentRow`, `SkeletonBox`, `SkeletonChip`, `SkeletonBarGraph`, `SkeletonSpendingBreakdown`, `SkeletonCalendar`, `SkeletonCardHeading`…) in `skeletonLoader-default` `rgba(255,255,255,0.1)`.
  - Rows (#38408–38411): a **32×32 round** avatar with `mr: 2`, two text bars **h 19, radius small (6)**, and a value bar **46×21**.
  - Card headings (#38395): bars of **h 24 × w 96** and **h 16 × w 243 / 169**.
  - Bar graph (#38391): **120×64** bars with **21×36** labels.
  - Bars are `rm-dimension-border-radius-small`; avatars are round.
  - Skeleton cards sit on `rm-color-fill-default` with `pv: 3, ph: 2.5`.
- **Ours:** generic `radius.md` blocks of arbitrary heights (`[180, 320, 64, 64]`) with no motion. Transactions shows a spinner only for pagination.
- **Change:**
  - Make `Skeleton` default to `borderRadius: radius.sm`.
  - Add `SkeletonRow` (32 px circle, a 60 %-width and a 35 %-width 19-px bar, a 46×21 trailing bar) and `SkeletonCard({rows})`, which uses a `Card` wrapper.
  - Animate opacity `0.5 → 1` in a loop: `Animated.loop(Animated.sequence([...timing 700ms]))`, `useNativeDriver: true`.
  - Replace each screen's block list with Card + heading bars + 4–5 `SkeletonRow`s mirroring the real layout.

### 11. Press feedback: one rule
- **Files:** `mobile/src/components/ui.tsx` (`ListRow`, `Card`), `components/transactions/TransactionRow.tsx`, `components/recurring/RecurringRow.tsx`, `components/spending/BreakdownCard.tsx`, `components/dashboard/AccountsCard.tsx`.
- **RM:** `CardClickable` (`CardDNA` `config: 'clickable'`) uses the overlay **`rm-component-card-fill-pressed` `rgba(0,0,0,0.1)`**. Secondary buttons use `button-fill-secondaryOnDark-pressed` `rgba(255,255,255,0.1)`, and primary-on-dark uses `rgba(255,255,255,0.8)`. Pressables go through `PressableStateMachine`.
- **Ours:** three different behaviours. `ListRow` uses a `rgba(255,255,255,0.05)` background. `TransactionRow` and `RecurringRow` use `opacity: 0.7`, which also fades logos and amounts. `BreakdownCard` rows have no feedback at all.
- **Change:**
  - Rows highlight with `rgba(255,255,255,0.06)` and `marginHorizontal: -space(4), paddingHorizontal: space(4)` so the highlight spans the card.
  - Whole tappable cards get a `Pressable` `Card` variant with an `rgba(0,0,0,0.1)` overlay.
  - Remove the `opacity: 0.7` wrappers.
  - Add the same pressed style to the `BreakdownCard` category `Pressable`.

### 12. Merchant logos and avatars
- **Files:** `mobile/src/components/MerchantLogo.tsx`, `components/CategoryIcon.tsx`, `components/transactions/TransactionRow.tsx`.
- **RM:** row avatars are 32–36 px round (`SkeletonContentRow` 32; transaction rows 36 per the capture). `rm-color-fill-iconContainer` is `rgba(0,0,0,0)` in dark mode and `rgba(0,0,0,0.05)` in light. `categoryIconContained-baseColor` is `#FFFFFF` glyphs on the category colour. Logos are also used inside chips (`Chip` `logo` prop).
- **Ours:** remote logos sit on a hard `#fff` disc with no edge, which glares against `#2B2B2B`. The letter fallback is grey `#404040`, which carries no information when the category is known.
- **Change:**
  - Add a `StyleSheet.hairlineWidth` ring in `rgba(255,255,255,0.12)` (`borderWidth` on the `Image` style).
  - Set `resizeMode="cover"`.
  - Show a `skeleton`-coloured placeholder until `onLoad`.
  - In `TransactionRow`, pass the category so the fallback after a logo `onError` is `CategoryIcon`, not a letter. Give `MerchantLogo` a `fallback?: ReactNode` prop.
  - Keep the letter avatar only for recurring streams with no category, and tint it with a stable hash into the category palette (`rm-color-category-custom-*`: `#149CD6 #3FB24B #5D33D6 #DE7412 #D02462 #1DC1B7`).

### 13. Empty states with an icon, body and action
- **File:** `mobile/src/components/ui.tsx` (`EmptyState`). Used in `app/(tabs)/recurring.tsx`, `components/transactions/TransactionList.tsx`, `components/spending/BreakdownCard.tsx`.
- **RM literal copy:** "You do not have any recurring charges within the next 7 days.", "No transactions found", "No spending data available for this week.", and the budget empty state (`BudgetsExperienceEmptyState`) "Control your spend · Get recommended spend targets · Begin".
- **Ours:** title and optional body only, with no visual anchor or CTA. BreakdownCard shows a bare "No spending yet".
- **Change:**
  - Add `icon?: LucideIcon` and `action?: {label, onPress}` props.
  - Render a 48 px round `colors.accentFill` disc with a 24 px `colors.textSubtle` glyph, then the title (`headingXXS`), the body (`paragraph`, `textSubtle`, `maxWidth: 280`), and an optional secondary `Button`.
  - Use RM's "within the next 7 days" phrasing for Upcoming.

### 14. Carousel pagination dots
- **File:** `mobile/src/components/dashboard/SpendCarousel.tsx` (`styles.dot`).
- **RM:** the dot is `{height: 6.75, width: 6.75, borderRadius: round}` (#38019). Inactive uses `carouselPagination-fill-inactive` **`rgba(255,255,255,0.15)`**; active is white.
- **Ours:** 6 px dots, inactive `#404040`. They update only on `onMomentumScrollEnd`, so they lag behind the swipe.
- **Change:** use 7 px dots with inactive `colors.track`. Drive the active state from `onScroll` (`scrollEventThrottle={16}`, `Math.round(x / width)`). Optionally widen the active dot to 16 px with `Animated` for a pill indicator.

### 15. Month selector as a header pill
- **File:** `mobile/src/components/spending/MonthSelector.tsx`.
- **RM:** `HeaderTimePeriodSelector#43567` is a **56 px-high** pressable with `pl: 2` and left radii **16** (`bottomLeft/topLeft: 16`). It has an `event` calendar icon with `mr: 1.75` and a `LabelRegular` label. It sits in a container `{mh: 2, pb: 2, mt: 2}`. Labels come from `RelativeTimePeriodName` ("This Month" / "Last Month").
- **Ours:** bare chevrons around a centred `labelL`, which reads like a pager rather than a control.
- **Change:**
  - Use a row `height: 48, borderRadius: radius.round, backgroundColor: colors.card, paddingHorizontal: space(2)`.
  - Left: `CalendarDays` 18 px with the label (`type.label`). Right: the chevron pair as 32×32 hit targets.
  - `selectionAsync` on change.

### 16. Transitions: accordion and sheets
- **Files:** `mobile/src/components/dashboard/AccountsCard.tsx`, `mobile/src/app/_layout.tsx`, `components/transactions/PickerSheet.tsx`.
- **RM:** the tab bar animates with `Animated` timings of **200 ms (out) / 250 ms (in)** and hides on bulk-edit via `AnimatedCollapse` and translateY. The progress bar is animated. Account rows expand in place. Pickers are bottom sheets (`useSheetOverlayModalScreens`) with `fill-dragHandle` `#545454`.
- **Ours:** the AccountsCard expand snaps open with a chevron icon swap. Picker presentation is whatever the stack default is.
- **Change:**
  - Call `LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))` before `setOpen`, and rotate one `ChevronRight` with `Animated` instead of swapping icons.
  - Register picker/edit routes with `presentation: 'formSheet'` plus `sheetGrabberVisible: true` (react-native-screens) and a `#545454` grabber, so they get native detents.

---

## Smaller token fixes, bundled
| File | Fix | RM value |
|---|---|---|
| `mobile/src/constants/theme.ts` | `tabBarBorder` `#4D4D4D` → `#545454` | `rm-component-tabBar-border` (literal; #4D4D4D was a pixel sample) |
| `mobile/src/constants/theme.ts` | add `progressWarning: '#DB6600'`, `chipSuccessBg: '#B5DDC6'`, `chipSuccessFg: '#0B5E36'`, `chipWarningBg: '#FFE6CC'`, `chipWarningFg: '#C25400'`, `cardPressed: 'rgba(0,0,0,0.1)'`, `borderTranslucent: 'rgba(255,255,255,0.4)'`, `dragHandle: '#545454'` | Appendix A tokens |
| `mobile/src/components/ui.tsx` | `SectionHeader` link: underline colour `colors.text` with pressed colour `brandText` (`#60A5FA`) | `link-text-primaryOnDark-pressed` (swapped red→blue) |

Not covered: light mode, Lottie/Rive celebration animations (licensed assets), and RM's custom icon font (we stay on Lucide). Pixel spacing beyond what's cited above is still inferred; a side-by-side device capture would confirm it.
