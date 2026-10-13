import type { DailySpendResponse } from '@contract';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { CalendarCheck, Flame, Sparkle, SlidersHorizontal } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Card, Chip, Divider, Money, ProgressBar, Skeleton } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { useReduceMotion } from '@/lib/motion';

import { $, isLastDay, monthName, stateCopy, streak, type HeroState } from './model';

const SAVER_KEY = 'financify.superSaverDay';

/** Body sentence per hero state (spec §6). */
function body(d: DailySpendResponse, s: HeroState): string {
  const t = d.today!;
  const allowance = t.allowance ?? 0;
  const left = t.left ?? 0;
  const projected = d.totals.projectedSavings ?? 0;
  if (s === 'over_budget')
    return d.plan.isFeasible
      ? "You've used this month's spending money, so new spend comes out of savings."
      : 'Your savings goal is higher than your income after bills.';
  if (s === 'over_today')
    return `You're ${$(-left)} over today. Tomorrow adjusts to ${$(t.tomorrowAllowance ?? 0)}, so there's no need to make it up all at once.`;
  if (isLastDay(d)) return `Finish under ${$(Math.max(left, 0))} and you'll save ${$(projected)} this month.`;
  if (s === 'super_saver')
    return `You're ahead of plan. Keep it under ${$(allowance)} a day and you'll beat your goal by ${$(projected - d.plan.savingsTarget)}.`;
  if (s === 'at_risk') return `Ease off a little. Keep to ${$(allowance)} a day for the rest of the month to still hit your goal.`;
  const tomorrow = t.tomorrowAllowance ?? allowance;
  return tomorrow > allowance
    ? `Stay under ${$(left)} today and tomorrow's allowance rises to ${$(tomorrow)}.`
    : `Stay under ${$(left)} today to keep tomorrow at ${$(tomorrow)}.`;
}

/** Daily allowance hero (spec §2 3a + §6). `data === null` renders the skeleton (state 8). */
export function HeroCard({
  data,
  onAdjust,
  onSetIncome,
}: {
  data: DailySpendResponse | null;
  onAdjust: () => void;
  onSetIncome: () => void;
}) {
  if (!data) return <HeroSkeleton />;
  const t = data.today;
  const copy = stateCopy(data);
  const s = copy.state;

  if (s === 'no_income') {
    return (
      <Card style={styles.empty}>
        <View style={styles.disc}>
          <CalendarCheck size={24} color={colors.textSubtle} />
        </View>
        <Text style={[type.headingXXS, { textAlign: 'center' }]}>Unlock your daily allowance</Text>
        <Text style={[type.paragraph, styles.emptyBody]}>
          Add your monthly income and we&apos;ll work out how much you can spend each day.
        </Text>
        <Pressable onPress={onSetIncome} accessibilityRole="button" style={({ pressed }) => [styles.onDark, pressed && { opacity: 0.8 }]}>
          <Text style={[type.labelS, { color: colors.textInverse }]}>Set monthly income</Text>
        </Pressable>
      </Card>
    );
  }

  // Past month: no "today", show the month verdict instead of an allowance.
  if (!t) {
    return (
      <Card style={styles.card}>
        <View style={styles.between}>
          <Text style={[type.labelS, { color: colors.textSubtle }]}>Flexible spend in {monthName(data.month)}</Text>
          <Chip variant={copy.variant} icon={copy.icon ?? undefined} label={copy.chip} />
        </View>
        <Money value={data.totals.flexibleSpent} size="xxl" cents={false} />
        {data.plan.flexibleBudget !== null ? (
          <ProgressBar value={data.totals.flexibleSpent} max={data.plan.flexibleBudget} />
        ) : null}
        <Text style={[type.paragraph, { color: colors.textSubtle }]}>{copy.title}</Text>
      </Card>
    );
  }

  const n = streak(data.days);
  const allowance = t.allowance ?? 0;
  const left = t.left ?? 0;
  const lastDay = isLastDay(data);
  const label =
    s === 'over_today'
      ? "Today's allowance"
      : s === 'over_budget'
        ? 'Spending money left'
        : lastDay
          ? `Last day of ${monthName(data.month)}`
          : 'You can spend';
  const streakOn = (s === 'on_track' || s === 'super_saver') && n >= 2;
  const streakText = streakOn ? `${n}-day on-track streak` : s === 'over_today' ? 'Streak resets tomorrow' : 'Streak paused';

  return (
    <Card style={styles.card}>
      {s === 'super_saver' ? <SaverGlow /> : null}
      <View
        style={styles.between}
        accessible
        accessibilityLabel={`You can spend ${$(allowance)} today. ${$(t.spent)} spent, ${$(Math.max(left, 0))} left.`}
      >
        <Text style={[type.labelS, { color: colors.textSubtle }]}>{label}</Text>
        <StateChip state={s} variant={copy.variant} icon={copy.icon} label={copy.chip} date={t.date} />
      </View>

      {s === 'over_budget' ? (
        <Money value={0} size="xxl" cents={false} suffix="left" color={colors.textSubtle} />
      ) : (
        <Money value={allowance} size="xxl" cents={false} suffix={lastDay ? 'for today' : 'today'} />
      )}

      <View style={styles.between}>
        <Text style={[type.labelS, styles.num]}>
          {$(t.spent)} spent{s === 'over_budget' ? ' today' : ''}
        </Text>
        <Text
          style={[
            type.labelS,
            styles.num,
            { color: s === 'over_budget' || left < 0 ? colors.warning : colors.textSubtle },
          ]}
        >
          {s === 'over_budget' ? `${$(t.overBy)} over plan` : left < 0 ? `${$(-left)} over` : `${$(left)} left`}
        </Text>
      </View>
      <ProgressBar value={t.spent} max={allowance} full={s === 'over_budget'} />

      <Text style={[type.paragraph, { color: colors.textSubtle }]}>{body(data, s)}</Text>
      <Divider />

      {s === 'over_budget' ? (
        <Pressable onPress={onAdjust} accessibilityRole="button" hitSlop={8} style={styles.footerLeft}>
          <SlidersHorizontal size={16} color={colors.text} />
          <Text style={type.labelS}>{data.plan.isFeasible ? 'Adjust savings goal' : 'Lower your goal'}</Text>
        </Pressable>
      ) : (
        <View style={styles.between}>
          <View style={styles.footerLeft}>
            <Flame size={16} color={streakOn ? colors.warning : colors.textDisabled} />
            <Text style={[type.labelS, { color: streakOn ? colors.text : colors.textIgnored }]}>{streakText}</Text>
          </View>
          <Text style={[type.caption, { color: colors.textIgnored }]}>
            {lastDay ? 'Last day' : `${t.daysRemaining} days left`}
          </Text>
        </View>
      )}
    </Card>
  );
}

/** Chip that crossfades on state change and celebrates the first super_saver of the day. */
function StateChip({
  state,
  variant,
  icon,
  label,
  date,
}: {
  state: HeroState;
  variant: Parameters<typeof Chip>[0]['variant'];
  icon: Parameters<typeof Chip>[0]['icon'] | null;
  label: string;
  date: string;
}) {
  const reduce = useReduceMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(state);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (prev.current !== state) {
      // Passive refetch flip: crossfade only, no haptic.
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      prev.current = state;
    }
  }, [state, fade]);

  useEffect(() => {
    if (state !== 'super_saver') return;
    let live = true;
    void (async () => {
      const seen = await SecureStore.getItemAsync(SAVER_KEY).catch(() => null);
      if (!live || seen === date) return;
      await SecureStore.setItemAsync(SAVER_KEY, date).catch(() => {});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (reduce) return;
      scale.setValue(0.9);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 12 }).start();
      setBurst((b) => b + 1);
    })();
    return () => {
      live = false;
    };
  }, [state, date, reduce, scale]);

  return (
    <View>
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <Chip variant={variant} icon={icon ?? undefined} label={label} />
      </Animated.View>
      {burst ? <SparkleBurst key={burst} /> : null}
    </View>
  );
}

const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  const d = 24 + (i % 3) * 8;
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, color: i % 2 ? colors.brandBold : colors.success };
});

/** One-shot burst: 8 four-point sparkles drifting 24–40 px out, fading over 700 ms. */
function SparkleBurst() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [t]);
  return (
    <View pointerEvents="none" style={styles.burst}>
      {SPARKS.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
            ],
          }}
        >
          <Sparkle size={10} color={p.color} fill={p.color} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Static super-saver glow: radial gradient from the top-right corner. */
function SaverGlow() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <RadialGradient id="glow" cx={box.w * 0.85} cy={0} rx={box.w * 0.8} ry={box.h * 0.6} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={colors.saverGlow} stopOpacity={0.6} />
              <Stop offset="1" stopColor={colors.saverGlow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={box.w} height={box.h} fill="url(#glow)" />
        </Svg>
      ) : null}
    </View>
  );
}

function HeroSkeleton() {
  return (
    <Card style={styles.card}>
      <View style={styles.between}>
        <Skeleton height={16} width={110} />
        <Skeleton height={28} width={84} round />
      </View>
      <Skeleton height={48} width={120} />
      <Skeleton height={6} />
      <View style={{ gap: 6 }}>
        <Skeleton height={16} />
        <Skeleton height={16} width={200} />
      </View>
      <View style={styles.between}>
        <Skeleton height={16} width={160} />
        <Skeleton height={16} width={64} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: space(3) },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2) },
  num: { fontVariant: ['tabular-nums'] },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  burst: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: space(3) },
  disc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: { color: colors.textSubtle, textAlign: 'center', maxWidth: 280 },
  onDark: {
    height: 40,
    paddingHorizontal: space(4),
    borderRadius: radius.round,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
