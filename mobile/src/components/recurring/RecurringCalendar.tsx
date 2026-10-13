import type { RecurringStream } from '@contract';
import { StyleSheet, Text, View } from 'react-native';

import { MerchantLogo } from '@/components/MerchantLogo';
import { Card } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { moneyCompact, monthLabel } from '@/lib/format';

import { occurrences } from './utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month grid for today's month: outflow logos on due dates, income totals in green. */
export function RecurringCalendar({ today, streams }: { today: string; streams: RecurringStream[] }) {
  const month = today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = new Date(y, m - 1, 1).getDay();
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const byDay: Record<number, { out: RecurringStream[]; income: number }> = {};
  for (const s of streams) {
    if (!s.isActive) continue;
    const dates = new Set(occurrences(s, from, to));
    if (s.lastDate?.startsWith(month)) dates.add(s.lastDate);
    for (const d of dates) {
      const cell = (byDay[Number(d.slice(8))] ??= { out: [], income: 0 });
      if (s.direction === 'inflow') cell.income += s.amount;
      else cell.out.push(s);
    }
  }

  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const todayNum = Number(today.slice(8));

  return (
    <Card style={{ gap: space(2) }}>
      <Text style={type.label}>{monthLabel(month)}</Text>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <Text key={`w${i}`} style={[type.captionS, styles.cell, { color: colors.textSubtle, minHeight: 0 }]}>
            {w}
          </Text>
        ))}
        {cells.map((day, i) => {
          const c = day ? byDay[day] : undefined;
          const label = c
            ? `${day}: ${c.out.map((s) => s.name).join(', ')}${c.income ? ` income ${moneyCompact(c.income)}` : ''}`
            : undefined;
          return (
            <View key={i} style={styles.cell} accessible={!!c} accessibilityLabel={label}>
              {day ? (
                <>
                  <Text
                    style={[
                      type.caption,
                      day < todayNum && { color: colors.textDisabled },
                      day === todayNum && styles.today,
                    ]}
                  >
                    {day}
                  </Text>
                  {c?.out.length ? (
                    <View style={styles.logos}>
                      {c.out.slice(0, 2).map((s) => (
                        <MerchantLogo key={s.id} uri={s.logoUrl} name={s.name} size={14} />
                      ))}
                    </View>
                  ) : null}
                  {c?.income ? (
                    <Text style={[type.captionS, { color: colors.success }]} numberOfLines={1}>
                      +{moneyCompact(c.income)}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', textAlign: 'center', minHeight: 44, gap: 2, paddingVertical: 2 },
  today: { backgroundColor: colors.brand, borderRadius: radius.round, overflow: 'hidden', paddingHorizontal: 5 },
  logos: { flexDirection: 'row', gap: 1 },
});
