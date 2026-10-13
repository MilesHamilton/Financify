import type { Txn } from '@contract';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { moneyCompact, parseDay } from '@/lib/format';

const H = 140;
const LABEL = 18;

/** Sum of |amount| per month, oldest first, last `max` months that have charges. */
export function monthlyTotals(history: Txn[], max = 12) {
  const m = new Map<string, number>();
  for (const t of history) m.set(t.date.slice(0, 7), (m.get(t.date.slice(0, 7)) ?? 0) + Math.abs(t.amount));
  return [...m].sort(([a], [b]) => a.localeCompare(b)).slice(-max);
}

/** Bar with only the top corners rounded (r = 3), as an SVG path. */
export function topRoundedBar(x: number, y: number, w: number, h: number, r = 3): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

const mmmYY = (month: string) => {
  const d = parseDay(`${month}-01`);
  return `${d.toLocaleDateString('en-US', { month: 'short' })} ${String(d.getFullYear()).slice(2)}`;
};

/** RM RecurringExpensesBarChart: one bar per month, labelled "MMM yy". */
export function HistoryBarChart({ history }: { history: Txn[] }) {
  const [width, setWidth] = useState(0);
  const data = monthlyTotals(history);
  const top = Math.max(...data.map(([, v]) => v), 1);
  const slot = data.length ? width / data.length : 0;
  const bar = Math.min(slot * 0.6, 28);
  const plot = H - LABEL - 14;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Charge history: ${data.map(([m, v]) => `${mmmYY(m)} ${moneyCompact(v)}`).join(', ')}`}
    >
      {width > 0 ? (
        <Svg width={width} height={H}>
          {data.map(([month, v], i) => {
            const h = Math.max((v / top) * plot, 2);
            const x = i * slot + (slot - bar) / 2;
            const last = i === data.length - 1;
            return (
              <Path key={month} d={topRoundedBar(x, H - LABEL - h, bar, h)} fill={last ? colors.chartLine : colors.chartSecondary} />
            );
          })}
          {data.map(([month], i) =>
            // Every other label past 6 months so "MMM yy" labels don't collide.
            data.length > 6 && (data.length - 1 - i) % 2 ? null : (
            <SvgText key={`l${month}`} x={i * slot + slot / 2} y={H - 4} fill={colors.textSubtle} fontSize={10} textAnchor="middle">
              {mmmYY(month)}
            </SvgText>
            ),
          )}
        </Svg>
      ) : null}
    </View>
  );
}
