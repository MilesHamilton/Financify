import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, type } from '@/constants/theme';

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

/**
 * Cumulative spend this month (solid line + area) vs. last month (dashed),
 * with an optional dashed BUDGET reference line. Data are cumulative dollars
 * per day of month, index 0 = day 1.
 */
export function SpendChart({
  current,
  prior,
  budget,
  daysInMonth,
  height = 140,
}: {
  current: number[];
  prior: number[];
  budget: number | null;
  daysInMonth: number;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...current, ...prior, budget ?? 0) * 1.08;
  const x = (i: number) => (daysInMonth <= 1 ? 0 : (i / (daysInMonth - 1)) * (width - 8) + 4);
  const y = (v: number) => height - (v / max) * (height - 8) - 4;

  const cur = current.map((v, i) => [x(i), y(v)] as [number, number]);
  const pri = prior.slice(0, daysInMonth).map((v, i) => [x(i), y(v)] as [number, number]);
  const curPath = smoothPath(cur);
  const last = cur[cur.length - 1];
  const area = last ? `${curPath} L${last[0]},${height} L${cur[0][0]},${height} Z` : '';

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.chartArea} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.chartArea} stopOpacity="0.15" />
            </LinearGradient>
          </Defs>
          {budget !== null ? (
            <Line x1={0} x2={width} y1={y(budget)} y2={y(budget)} stroke={colors.border} strokeDasharray="4 4" />
          ) : null}
          {pri.length > 1 ? (
            <Path d={smoothPath(pri)} stroke={colors.chartAxis} strokeWidth={2} strokeDasharray="3 5" fill="none" />
          ) : null}
          {area ? <Path d={area} fill="url(#area)" /> : null}
          {curPath ? <Path d={curPath} stroke={colors.chartLine} strokeWidth={3} fill="none" /> : null}
          {last ? <Circle cx={last[0]} cy={last[1]} r={5} fill="#fff" /> : null}
        </Svg>
      ) : null}
      {budget !== null && width > 0 ? (
        <Text style={[type.tracked, { position: 'absolute', right: 0, top: Math.max(0, y(budget) - 16), color: colors.textSubtle, fontSize: 10 }]}>
          Budget
        </Text>
      ) : null}
    </View>
  );
}
