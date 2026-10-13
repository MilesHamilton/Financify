import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, radius, type } from '@/constants/theme';
import { money, moneyCompact } from '@/lib/format';

/** Smooth monotone path through points (RM charts use monotone curves). */
export function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

const GUTTER = 36;

/** RM calculateYAxisTicks: [max, floor(max/2), 0]. */
export const yTicks = (max: number) => [max, Math.floor(max / 2), 0];

/**
 * Press-and-scrub (polish #8): PanResponder maps locationX to an index over
 * `count` slots in a plot `plotWidth` wide; fires `selectionAsync` per index
 * change and reports the index (null on release).
 */
export function useScrub(
  count: number,
  plotWidth: number,
  onScrub?: (i: number | null) => void,
  inset = 0,
  /** A quick press without moving to another index. */
  onTap?: (i: number) => void,
) {
  const [index, setIndex] = useState<number | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const cfg = useRef({ count, plotWidth, onScrub, inset, onTap });
  cfg.current = { count, plotWidth, onScrub, inset, onTap };
  const last = useRef<number | null>(null);
  const start = useRef({ i: -1, at: 0, moved: false });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        fade.stopAnimation();
        fade.setValue(1);
        move(e.nativeEvent.locationX);
        start.current = { i: last.current ?? -1, at: Date.now(), moved: false };
      },
      onPanResponderMove: (e) => move(e.nativeEvent.locationX),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    }),
  ).current;

  function move(x: number) {
    const { count: n, plotWidth: w, inset: pad } = cfg.current;
    if (n <= 0 || w <= 0) return;
    const i = Math.max(0, Math.min(n - 1, n === 1 ? 0 : Math.round(((x - pad) / (w - pad * 2)) * (n - 1))));
    if (i === last.current) return;
    if (last.current !== null) start.current.moved = true;
    last.current = i;
    void Haptics.selectionAsync();
    setIndex(i);
    cfg.current.onScrub?.(i);
  }
  function end() {
    const s0 = start.current;
    if (!s0.moved && s0.i >= 0 && Date.now() - s0.at < 300) cfg.current.onTap?.(s0.i);
    last.current = null;
    cfg.current.onScrub?.(null);
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setIndex(null);
    });
  }

  return { index, fade, handlers: pan.panHandlers };
}

/** Tooltip pill 4 px above the plot, clamped inside the chart. */
export function ScrubTooltip({ x, width, label, fade }: { x: number; width: number; label: string; fade: Animated.Value }) {
  const [w, setW] = useState(0);
  const left = Math.max(0, Math.min(width - w, x - w / 2));
  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[styles.tooltip, { left, opacity: fade }]}
    >
      <Text style={[type.caption, { color: colors.textInverse, fontWeight: '500', fontVariant: ['tabular-nums'] }]}>{label}</Text>
    </Animated.View>
  );
}

/**
 * Cumulative spend this month (solid line + area) vs. last month (dashed),
 * with an optional dashed BUDGET reference line, a right y gutter and
 * 1 / mid / last x labels. Data are cumulative dollars per day, index 0 = day 1.
 */
export function SpendChart({
  current,
  prior,
  budget,
  daysInMonth,
  height = 140,
  xLabels,
  yBase = 0,
  tooltip,
  onScrub,
}: {
  current: number[];
  prior: number[];
  budget: number | null;
  daysInMonth: number;
  height?: number;
  /** Three labels for the first, middle and last slot. */
  xLabels?: [string, string, string];
  /** Added to tick labels when the series was offset (net worth). */
  yBase?: number;
  /** Scrub tooltip copy for an index, e.g. "Oct 9 · $46". Enables scrubbing. */
  tooltip?: (i: number) => string;
  onScrub?: (i: number | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const plotW = Math.max(0, width - GUTTER);
  const top = Math.max(1, ...current, ...prior, budget ?? 0);
  const max = Math.ceil((top * 1.05) / 10) * 10;
  const x = (i: number) => (daysInMonth <= 1 ? 4 : (i / (daysInMonth - 1)) * (plotW - 8) + 4);
  const y = (v: number) => height - (v / max) * (height - 8) - 4;
  const scrub = useScrub(tooltip ? current.length : 0, plotW, onScrub, 4);

  const cur = current.map((v, i) => [x(i), y(v)] as [number, number]);
  const pri = prior.slice(0, daysInMonth).map((v, i) => [x(i), y(v)] as [number, number]);
  const curPath = smoothPath(cur);
  const last = cur[cur.length - 1];
  const area = last ? `${curPath} L${last[0]},${height} L${cur[0][0]},${height} Z` : '';
  const sel = scrub.index !== null ? cur[scrub.index] : null;
  const dot = sel ?? last;

  const lastVal = current[current.length - 1] ?? 0;
  const summary = `Spent ${money(lastVal + yBase, true)} so far${budget !== null ? `, budget ${money(budget, true)}` : ''}`;

  return (
    <View accessible accessibilityLabel={summary}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height, flexDirection: 'row' }}>
        <View style={{ width: plotW, height }} {...(tooltip ? scrub.handlers : null)}>
          {width > 0 ? (
            <Svg width={plotW} height={height}>
              <Defs>
                <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.chartArea} stopOpacity="1" />
                  <Stop offset="1" stopColor={colors.chartArea} stopOpacity="0.15" />
                </LinearGradient>
              </Defs>
              {budget !== null ? (
                <Line x1={0} x2={plotW} y1={y(budget)} y2={y(budget)} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
              ) : null}
              {pri.length > 1 ? (
                <Path d={smoothPath(pri)} stroke={colors.chartAxis} strokeWidth={2} strokeDasharray="3 5" fill="none" />
              ) : null}
              {area ? <Path d={area} fill="url(#area)" /> : null}
              {curPath ? <Path d={curPath} stroke={colors.chartLine} strokeWidth={3} fill="none" /> : null}
              {sel ? <Line x1={sel[0]} x2={sel[0]} y1={0} y2={height} stroke={colors.chartAxis} strokeWidth={1} /> : null}
              {dot ? <Circle cx={dot[0]} cy={dot[1]} r={5} fill={colors.text} /> : null}
            </Svg>
          ) : null}
          {budget !== null && width > 0 ? (
            <Text style={[type.tracked, { position: 'absolute', right: 4, top: Math.max(0, y(budget) - 16), color: colors.textSubtle }]}>
              Budget
            </Text>
          ) : null}
          {sel && tooltip && scrub.index !== null ? (
            <ScrubTooltip x={sel[0]} width={plotW} label={tooltip(scrub.index)} fade={scrub.fade} />
          ) : null}
        </View>
        <View style={styles.gutter}>
          {yTicks(max).map((t) => (
            <Text key={t} style={[type.captionS, styles.tick]}>
              {moneyCompact(t + yBase)}
            </Text>
          ))}
        </View>
      </View>
      {xLabels ? (
        <View style={[styles.xRow, { width: plotW }]}>
          {xLabels.map((l, i) => (
            <Text key={i} style={[type.captionS, { color: colors.textSubtle }]}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: { width: GUTTER, justifyContent: 'space-between', alignItems: 'flex-end' },
  tick: { color: colors.textSubtle, fontVariant: ['tabular-nums'] },
  xRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  tooltip: {
    position: 'absolute',
    top: -30,
    height: 26,
    paddingHorizontal: 12,
    borderRadius: radius.round,
    backgroundColor: colors.text,
    justifyContent: 'center',
  },
});
