# Phase 2 Report — UI Screens + IA + Typography

**Completed:** 2026-07-15 · **Mode:** team execution (team `redesign-phase2`, 4 waves)
**Scope:** T-R40–T-R73 (UI screens, 4-tab IA + redirects, DM Sans + tokens, v1 removal). Phase 1 (backend/model, T-R00–T-R32) was already on `main` (commits d848184…f442952).

---

## 1. Task completion (all committed on `main`, gates green)

| Task | Wave | Commit | Summary |
|------|------|--------|---------|
| T-R60 | 1 | `c9434a7` | Self-host DM Sans (4 variable woff2), add design tokens, archive design source to `docs/specs/ui-redesign/design/` |
| T-R42 + T-R52 | 2 | `339fa88` | Dashboard rewrite — SVG month-bar selector, donut, cash-balance area, Recent Transactions link (no Recharts) |
| T-R43 | 2 | `f4283fd` | Settings rewrite — BUDGET + ACCOUNT sections, notif toggle stub, red logout |
| T-R40 + T-R44 | 2 | `93f7fe3` | Budget rewrite — month pills, Spending/Bills/Earnings cards, Savings Target card, Category Budgets + new `CategoryBudgetRow` |
| T-R41 | 2 | `faa6e32` | Recurring screen (new) — split summary, UPCOMING/PAID lists, polished EmptyState |
| T-R51 | 3 | `1c4e0e6` | 308 redirects `/spending`→`/`, `/accounts`→`/settings` |
| T-R50 | 3 | `70eb79e` + `d17df6f` | 4-tab bar; tab order corrected to prototype/FRD (Budget, Dashboard, Recurring, Settings) |
| T-R61 | 3 | `6f9a79f` | Radius/typography audit; fixed one section-header bug in `TransactionGroup.tsx` |
| T-R70 + T-R71 | 4 | (no code change) | Full gates + webpack build green; static/unit smoke verification |
| T-R73 | 4 | `33c2045` | Remove v1 budget path, delete `/spending` + `/accounts` pages + 15 orphaned components, drop Recharts |

**11 task-IDs delivered across 10 commits** (plus the T-R50 order-fix `d17df6f`). **T-R72 is BLOCKED** — no `.env.local`/credentials (see §5).

## 2. Quality gates (final tree, HEAD `33c2045`)

- **lint:** clean (`eslint app/**/*.{ts,tsx} src/**/*.{ts,tsx}`).
- **tsc --noEmit:** clean, exit 0.
- **test:** 41 passing / 44. The **3 failures are the pre-existing** `src/lib/sync.test.ts` integration tests (require live `DATABASE_URL`) — identical to the Phase-1 baseline, zero new failures. All V2 `budget.test.ts` pass.
- **build (`npm run build`, webpack):** **succeeds.** All app routes compile — `/`, `/budget`, `/recurring`, `/settings`, `/transactions` (dynamic). `/spending` and `/accounts` are correctly absent as page routes (now 308 redirect-only). Only warnings are pre-existing/unrelated (next-auth→jose Edge-Runtime `CompressionStream` notices; middleware→proxy deprecation). This build is the strongest full-app check available without a DB.

## 3. Fidelity notes / deviations from the prototype

1. **Budget — Bills & Earnings side-by-side** (not the dc.html's single stacked Bills card). Followed `screenshot-1.png` per the brief's "follow the screenshots" instruction. Added an Earnings card (`Banknote` icon; lucide lacks a money-bag glyph; dc.html had no Earnings card).
2. **Budget — whole-dollar formatting via a local `fmtDollars` helper instead of the `Amount` component.** `Amount` always renders 2dp ("$1,305.00") but the prototype's `fmt` shows whole dollars ("$1,305 left to spend"). Prototype fidelity was prioritized; negative/over-budget headline coloring is applied manually via `--color-negative` (a `negative` prop on the card), so the "negative STS renders red" requirement is still met — just not through `Amount`. **This is the most notable convention deviation** (the project standard is "money through `Amount`").
3. **Dashboard — donut has no separate "Bills & Utilities" segment.** The real `getCategoryBreakdown` already returns all expense categories (bills included), so the donut = category breakdown and its total equals `getMonthSpend.totalSpend`. The prototype split bills out because its mock data modeled bills separately. Month bars use real per-month income/spend (`maxBar` computed from data, not the prototype's fixed 5400). Cash-balance card requires ≥2 real snapshots or it hides; ticks use real dates.
4. **Settings — expandable accordions instead of modal/navigation** for "Monthly budget" / "Savings target" rows, so the existing editors (`IncomeOverrideEditor`, per-category `BudgetEditor`, `SavingsTargetEditor`) are reused unchanged, revealed on tap. Reconnect link shows unconditionally per institution (prototype always shows it; old page gated on non-active status — harmless, re-auth on active item is a no-op).
5. **Settings — dropped the old "Add account" (`LinkAccountButton`) and "Install prompt" (A2HS) sections** — neither appears in the prototype's Settings screen. **Product gap:** "add a new institution" now has no home in the redesigned IA (see §6, remaining human actions).
6. **TabBar — order corrected to Budget, Dashboard, Recurring, Settings** to match the design source of truth (dc.html `TABS`) and FRD §2. The orchestration brief's prose listed Dashboard-first; both authoritative specs list Budget-first, and this phase's mandate is prototype fidelity. **Active-tab color kept `#f2f4f8`** per the orchestration brief's explicit instruction — note the prototype dc.html actually colors the active tab with the accent `#6c8cff`. If accent-on-active is preferred, it's a one-line change.
7. **All screens degrade gracefully with no DB** — every server data fetch is wrapped in try/catch and falls back to Skeleton→EmptyState. This is required here (no `.env.local`) and is also correct production behavior.

## 4. Recharts decision

**Removed.** After deleting `/spending` + `/accounts` pages and their orphaned components, a full-tree grep found **zero live `recharts` imports**. All five former consumers were deleted as orphans (`BalanceLineChart`, `spending/CategoryDonut`, `spending/MonthlySpendBarChart`, `dashboard/MiniSpendBar`, and the shadcn wrapper `ui/chart.tsx`). `"recharts"` was removed from `package.json`; `npm install` updated `package-lock.json` (both committed in `33c2045`). The redesign's charts (donut, month bars, cash-balance area) are all hand-rolled SVG.

## 5. What needs credentialed verification (T-R72 — BLOCKED)

No `.env.local` exists in this environment, so no DB/Plaid access was possible. The following are **unverified against live data** and must be checked in a credentialed sandbox:
- **T-R72 (primary):** trigger a real sync, confirm `recurring_streams` populates, confirm `/recurring` renders real upcoming/paid splits and the Bills & Utilities card shows real numbers. Inherits Phase-1 risk R1 (Plaid `transactionsRecurringGet` never live-exercised).
- **Live HTTP 308 redirects** for `/spending`→`/` and `/accounts`→`/settings` (config verified statically; not exercised over HTTP).
- **Real-data rendering fidelity** of every screen (donut segments, month-bar scaling, balance path, savings bar/advice, category rows) — only prototype/mock fidelity and graceful-empty states were verifiable here.

**How to run T-R72 later:** add `.env.local` with `DATABASE_URL` (Neon) + `PLAID_ENV=sandbox` + Plaid sandbox keys; `npm run dev`; link sandbox institution `ins_109508`; trigger the sync cron or `POST /api/sync/trigger`; confirm `recurring_streams` rows and `/recurring` real data.

## 6. Remaining human actions

1. **Run T-R72** in a credentialed sandbox (above) — this is the main open verification gap.
2. **Decide where "Add account" (link a new institution) lives** in the new IA — it was dropped from Settings to match the prototype and currently has no entry point. (The reconnect/update flow for existing accounts IS present in Settings.)
3. **Confirm two intentional prototype deviations are acceptable:** (a) active-tab color `#f2f4f8` vs prototype accent `#6c8cff`; (b) Budget whole-dollar `fmtDollars` vs the `Amount` component convention.
4. **Apply the Phase-1 migration** `0002_normal_rawhide_kid.sql` (generated, never applied — no DB) before the recurring features work against production.
5. Optional: revisit Phase-1 risk **R3** (matching-heuristic duplicated between `getBudgetStatusV2` and `getRecurringMonth` — keep in sync).

## 7. Process notes

- **Shared-working-tree commit races** occurred twice among parallel agents (an `git commit` without pathspec swept a sibling's staged files). Both were caught and cleanly resolved (one commit split via `reset --soft`; the recurring commit re-created by the lead). Mitigation adopted for Wave 3+: **explicit-pathspec commits** (`git commit -m "…" -- <own paths>`), which eliminated further races. Recommend this discipline as standard for parallel agents sharing one tree.
- **Tooling:** `ui-developer` subagents have no Bash tool (cannot copy binaries, run gates, or commit), so Phase-2 UI work was executed by full-tool agents that self-gate and self-commit. No browser/DB verification was possible regardless, so no craft-review capability was lost.
