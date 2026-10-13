import type { DailySpendResponse } from '@contract';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

import { topRoundedBar } from '@/components/recurring/HistoryBarChart';
import { ScrubTooltip, useScrub, yTicks } from '@/components/SpendChart';
import { Card, Skeleton } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { money, moneyCompact, shortDate } from '@/lib/format';

import { $, dayTitle } from './model';

const H = 112;
const GUTTER = 32;
const GAP = 3;

/**
 * Spend per day (spec §2 3b): one bar per calendar day, today outlined in
 * brand, future days as ghost bars, stepped dashed allowance line. Scrub to
 * inspect; tap a past/today bar to open its day sheet.
 */
export function DayBarChart({
  data,
  onSelectDay,
  onScrubbing,
}: {
  data: DailySpendResponse;
  onSelectDay: (date: string) => void;
  onScrubbing?: (active: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const days = data.days;
  const n = days.length;
  const plotW = Math.max(0, width - GUTTER - 8);
  const bar = n ? (plotW - GAP * (n - 1)) / n : 0;
  const top = Math.max(10, ...days.map((d) => Math.max(d.spent, d.allowance ?? 0)));
  const yMax = Math.ceil(top / 10) * 10;
  const h = (v: number) => (v / yMax) * H;
  const x = (i: number) => i * (bar + GAP);

  const tapDay = (i: number) => {
    if (!days[i].isFuture) onSelectDay(days[i].date);
  };
  const scrub = useScrub(n, plotW, (i) => onScrubbing?.(i !== null), bar / 2, tapDay);
  const sel = scrub.index !== null ? days[scrub.index] : null;

  const todayIdx = days.findIndex((d) => d.isToday);
  const todayAllowance = data.today?.allowance ?? null;
  const steps = days.flatMap((d, i) =>
    d.allowance === null ? [] : [`${x(i)},${H - h(d.allowance)}`, `${x(i) + bar + GAP},${H - h(d.allowance)}`],
  );
  const verdict = (d: (typeof days)[number]) =>
    d.allowance === null ? '' : d.spent > d.allowance ? `over by ${$(d.spent - d.allowance)}` : `under by ${$(d.allowance - d.spent)}`;

  return (
    <Card style={styles.card}>
      <View
        style={styles.header}
        accessible
        accessibilityLabel={`Spent ${$(data.totals.flexibleSpent)} so far this month${todayAllowance !== null ? `, ${$(todayAllowance)} allowance today` : ''}`}
      >
        {sel ? (
          <>
            <Text style={type.label}>{dayTitle(sel.date)}</Text>
            <Text style={[type.caption, styles.num, { color: colors.textIgnored }]}>
              {money(sel.spent)}
              {verdict(sel) ? ` · ${verdict(sel)}` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={type.label}>Spend per day</Text>
            <Text style={[type.caption, styles.num, { color: colors.textIgnored }]}>Avg {$(data.totals.averagePerDay)}/day</Text>
          </>
        )}
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.chartRow}>
        <View style={{ width: plotW, height: H }} {...scrub.handlers}>
          {width > 0 ? (
            <Svg width={plotW} height={H}>
              {days.map((d, i) => {
                const op = sel ? (scrub.index === i ? 1 : 0.4) : 1;
                if (d.isFuture) {
                  const a = d.allowance ?? 0;
                  return a > 0 ? <Path key={i} d={topRoundedBar(x(i), H - h(a), bar, h(a))} fill={colors.ghostBar} opacity={op} /> : null;
                }
                if (d.isToday) return null; // drawn by TodayBar below
                if (d.spent <= 0) return <Path key={i} d={`M${x(i)},${H - 2} h${bar} v2 h${-bar} Z`} fill={colors.track} opacity={op} />;
                const over = d.allowance !== null && d.spent > d.allowance;
                return (
                  <Path key={i} d={topRoundedBar(x(i), H - h(d.spent), bar, h(d.spent))} fill={over ? colors.warning : colors.chartLine} opacity={op} />
                );
              })}
              {todayIdx >= 0 ? (
                <TodayBar
                  x={x(todayIdx)}
                  w={bar}
                  allowance={h(Math.max(days[todayIdx].allowance ?? 0, 0))}
                  spent={h(Math.min(days[todayIdx].spent, yMax))}
                  opacity={sel ? (scrub.index === todayIdx ? 1 : 0.4) : 1}
                />
              ) : null}
              {steps.length ? (
                <Polyline points={steps.join(' ')} fill="none" stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
              ) : null}
            </Svg>
          ) : null}
          {/* Per-bar VoiceOver targets; plain Views so the pan responder keeps touches. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {width > 0
              ? days.map((d, i) => (
                  <View
                    key={d.date}
                    accessible
                    accessibilityRole={d.isFuture ? 'text' : 'button'}
                    accessibilityLabel={`${dayTitle(d.date)}, spent ${money(d.spent)}${d.allowance !== null ? `, allowance ${$(d.allowance)}` : ''}${d.isFuture ? '' : d.allowance !== null && d.spent > d.allowance ? ', over' : ', under'}`}
                    onAccessibilityTap={() => tapDay(i)}
                    pointerEvents="none"
                    style={{ position: 'absolute', left: x(i), width: bar, top: 0, bottom: 0 }}
                  />
                ))
              : null}
          </View>
          {sel && scrub.index !== null ? (
            <ScrubTooltip
              x={x(scrub.index) + bar / 2}
              width={plotW}
              label={`${shortDate(sel.date)} · ${$(sel.spent)}`}
              fade={scrub.fade}
            />
          ) : null}
        </View>
        <View style={styles.gutter}>
          {yTicks(yMax).map((t) => (
            <Text key={t} style={[type.captionS, styles.tick]}>
              {moneyCompact(t)}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.xRow, { width: plotW }]}>
        {todayIdx > 3 || todayIdx < 0 ? <Text style={[type.captionS, styles.xLabel]}>{shortDate(days[0]?.date ?? data.month + '-01')}</Text> : <View />}
        {todayIdx >= 0 ? (
          <Text
            style={[
              type.captionS,
              styles.today,
              { left: Math.max(0, Math.min(plotW - 40, x(todayIdx) + bar / 2 - 20)) },
            ]}
          >
            Today
          </Text>
        ) : null}
        {todayIdx < n - 4 ? <Text style={[type.captionS, styles.xLabel]}>{shortDate(days[n - 1]?.date ?? '')}</Text> : null}
      </View>

      <View style={styles.legend}>
        <Swatch color={colors.chartLine} label="Under" />
        <Swatch color={colors.warning} label="Over" />
        {todayIdx >= 0 ? <Swatch color={colors.brand} label="Today" /> : null}
        {todayAllowance !== null ? (
          <View style={styles.legendItem}>
            <View style={{ width: 12, height: 1, backgroundColor: colors.border }} />
            <Text style={[type.caption, { color: colors.textSubtle }]}>{$(todayAllowance)}/day allowance</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function TodayBar({ x, w, allowance, spent, opacity }: { x: number; w: number; allowance: number; spent: number; opacity: number }) {
  const outer = Math.max(allowance, spent, 2);
  return (
    <>
      <Path
        d={topRoundedBar(x + 0.75, H - outer + 0.75, w - 1.5, outer - 0.75)}
        fill={colors.todayBarFill}
        stroke={colors.brand}
        strokeWidth={1.5}
        opacity={opacity}
      />
      {spent > 0 ? <Path d={topRoundedBar(x, H - spent, w, spent)} fill={colors.brand} opacity={opacity} /> : null}
    </>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Text style={[type.caption, { color: colors.textSubtle }]}>{label}</Text>
    </View>
  );
}

/** Loading card: heading bar + 31 pulsing bars. */
export function DayBarChartSkeleton() {
  return (
    <Card style={styles.card}>
      <Skeleton height={24} width={96} />
      <View style={[styles.chartRow, { height: H, alignItems: 'flex-end', gap: GAP }]}>
        {SKELETON_BARS.map((hh, i) => (
          <Skeleton key={i} height={hh} style={{ flex: 1, borderRadius: 2 }} />
        ))}
      </View>
    </Card>
  );
}

const SKELETON_BARS = Array.from({ length: 31 }, () => 20 + Math.round(Math.random() * 60));

const styles = StyleSheet.create({
  card: { paddingTop: space(4), paddingHorizontal: space(4), paddingBottom: space(3), gap: space(3) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  num: { fontVariant: ['tabular-nums'] },
  chartRow: { flexDirection: 'row', height: H, gap: 8 },
  gutter: { width: GUTTER, justifyContent: 'space-between', alignItems: 'flex-end' },
  tick: { color: colors.textSubtle, fontVariant: ['tabular-nums'] },
  xRow: { flexDirection: 'row', justifyContent: 'space-between', height: 15 },
  xLabel: { color: colors.textSubtle },
  today: { position: 'absolute', width: 40, textAlign: 'center', color: colors.brandText, fontWeight: '500' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: space(1) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
