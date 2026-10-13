import type { DailySpendResponse } from '@contract';
import { Check, ChevronRight, Flame, Minus } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card, Chip, Divider, Money } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { parseDay } from '@/lib/format';
import { useReduceMotion } from '@/lib/motion';

import { $, stateCopy, streak } from './model';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Dashboard carousel page 1 (spec §3): today's allowance, week strip, status footer. */
export function DailySpendCard({
  data,
  onOpen,
  onSelectDay,
}: {
  data: DailySpendResponse;
  onOpen: () => void;
  onSelectDay: (date: string) => void;
}) {
  const t = data.today;
  const copy = stateCopy(data);
  const n = streak(data.days);
  const left = t?.left ?? 0;

  // Mon–Sun of the current week.
  const today = parseDay(t?.date ?? `${data.month}-01`);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = WEEK.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return iso(d);
  });
  const byDate = new Map(data.days.map((d) => [d.date, d]));

  return (
    <Card onPress={onOpen} accessibilityLabel={`Today you can spend ${$(t?.allowance ?? 0)}. See daily`} style={styles.card}>
      <View style={styles.between}>
        <Text style={[type.labelS, { color: colors.textSubtle }]}>Today you can spend</Text>
        {n >= 2 && (copy.state === 'on_track' || copy.state === 'super_saver') ? (
          <Chip variant="secondary" icon={Flame} iconColor={colors.warning} label={`${n} days`} />
        ) : copy.chip ? (
          <Chip variant={copy.variant} icon={copy.icon ?? undefined} label={copy.chip} />
        ) : null}
      </View>

      <View style={[styles.between, { alignItems: 'flex-end' }]}>
        <Money value={t?.allowance ?? 0} size="xxl" cents={false} countUp={500} />
        {t ? (
          <View style={styles.right}>
            <Text style={[type.label, styles.num, { color: left < 0 ? colors.warning : colors.success }]}>
              {left < 0 ? `${$(-left)} over` : `${$(left)} left`}
            </Text>
            <Text style={[type.caption, styles.num, { color: colors.textIgnored }]}>{$(t.spent)} spent so far</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.week}>
        {week.map((date, i) => {
          const d = byDate.get(date);
          const isToday = date === t?.date;
          return (
            <Pressable
              key={date}
              disabled={!d || d.isFuture}
              onPress={() => onSelectDay(date)}
              accessibilityRole="button"
              accessibilityLabel={d ? `${parseDay(date).toLocaleDateString('en-US', { weekday: 'long' })}, spent ${$(d.spent)}` : undefined}
              style={styles.day}
            >
              <Text style={[type.caption, isToday ? { color: colors.text, fontWeight: '600' } : { color: colors.textIgnored }]}>
                {WEEK[i]}
              </Text>
              {!d ? (
                <View style={styles.circle} />
              ) : isToday ? (
                <TodayRing day={d.day} spent={d.spent} allowance={d.allowance ?? 0} />
              ) : d.isFuture ? (
                <View style={[styles.circle, styles.future]}>
                  <Text style={[type.caption, { color: colors.textDisabled }]}>{d.day}</Text>
                </View>
              ) : d.allowance !== null && d.spent > d.allowance ? (
                <View style={[styles.circle, { backgroundColor: colors.warningFill }]}>
                  <Minus size={16} color={colors.text} />
                </View>
              ) : (
                <View style={[styles.circle, { backgroundColor: colors.successFill }]}>
                  <Check size={16} color={colors.success} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Divider />
      <View style={styles.between}>
        <Text style={[type.caption, { color: colors.textSubtle, flex: 1 }]} numberOfLines={1}>
          {copy.title}
          {t ? ` · ${t.daysRemaining} days left` : ''}
        </Text>
        <View style={styles.see}>
          <Text style={type.labelS}>See daily</Text>
          <ChevronRight size={16} color={colors.text} />
        </View>
      </View>
    </Card>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const R = 14.5;
const C = 2 * Math.PI * R;

/** 32 px progress ring: brand arc = spent ÷ allowance, warning when over; sweeps in over 600 ms. */
function TodayRing({ day, spent, allowance }: { day: number; spent: number; allowance: number }) {
  const reduce = useReduceMotion();
  const over = spent > allowance;
  const frac = allowance > 0 ? Math.min(spent / allowance, 1) : spent > 0 ? 1 : 0;
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) sweep.setValue(frac);
    else Animated.timing(sweep, { toValue: frac, duration: 600, useNativeDriver: false }).start();
  }, [frac, reduce, sweep]);
  return (
    <View style={styles.circle}>
      <Svg width={32} height={32} style={StyleSheet.absoluteFill}>
        <Circle cx={16} cy={16} r={R} stroke={colors.track} strokeWidth={3} fill="none" />
        <AnimatedCircle
          cx={16}
          cy={16}
          r={R}
          stroke={over ? colors.warning : colors.brand}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={sweep.interpolate({ inputRange: [0, 1], outputRange: [C, 0] })}
          transform="rotate(-90 16 16)"
        />
      </Svg>
      <Text style={[type.caption, { fontWeight: '600' }]}>{day}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: space(4) },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2) },
  right: { alignItems: 'flex-end', gap: 2, paddingBottom: 8 },
  num: { fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 36, alignItems: 'center', gap: 6 },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  future: { borderWidth: 1, borderColor: colors.divider },
  see: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
