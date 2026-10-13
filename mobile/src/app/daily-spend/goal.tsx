import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowRight, Minus, Plus, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { $, allowanceFor, billsReserved, useDailySpendStore } from '@/components/daily-spend/model';
import { Button, EmptyState, Money } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

const STEP = 50;
const snap = (v: number) => Math.round(v / STEP) * STEP;

/** Set savings goal sheet (spec §5): stepper, slider, presets, live allowance impact, plan breakdown. */
export default function GoalSheet() {
  const data = useDailySpendStore((s) => s.data);
  const invalidate = useDailySpendStore((s) => s.invalidate);
  const showToast = useToast((s) => s.show);
  const was = data?.plan.savingsTarget ?? 0;
  const [goal, setGoal] = useState(was);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!data) {
    return (
      <View style={styles.sheet}>
        <EmptyState title="Nothing to adjust yet" body="Open this from the Daily tab." />
      </View>
    );
  }

  const max = Math.max(0, data.plan.income - billsReserved(data));
  const set = (v: number) => {
    const next = Math.max(0, snap(v));
    if (next !== goal) void Haptics.selectionAsync();
    setGoal(next);
  };
  const before = data.today?.allowance ?? null;
  const after = allowanceFor(data, goal);
  const infeasible = goal > max;
  const flexible = data.plan.income - billsReserved(data) - goal;
  const delta = goal - was;
  const daysLeft = data.today?.daysRemaining ?? 0;
  const perDay = daysLeft ? Math.abs(delta) / daysLeft : 0;
  const presets = [...new Set([500, was, snap(max * 0.4), snap(max * 0.5)])].filter((v) => v >= 0).sort((a, b) => a - b).slice(0, 4);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await api('/api/settings', { method: 'PUT', body: { monthlySavingsTarget: goal } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      showToast(after !== null ? `Goal updated · ${$(after)}/day` : 'Goal updated');
      router.back();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={type.headingXS} accessibilityRole="header">
          Monthly savings goal
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
          <X size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.stepper}>
        <StepButton icon={Minus} label="Decrease goal" onStep={() => set(goal - STEP)} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Money value={goal} size="xxl" cents={false} suffix="/mo" />
          {goal !== was ? <Text style={[type.caption, { color: colors.textIgnored }]}>was {$(was)}</Text> : null}
        </View>
        <StepButton icon={Plus} label="Increase goal" onStep={() => set(goal + STEP)} />
      </View>

      <View style={{ gap: space(2) }}>
        <Slider value={goal} max={max} onChange={set} />
        <View style={styles.between}>
          <Text style={[type.caption, { color: colors.textIgnored }]}>$0</Text>
          <Text style={[type.caption, { color: colors.textIgnored }]}>{$(max)} max</Text>
        </View>
      </View>

      <View style={styles.presets}>
        {presets.map((p) => {
          const on = p === goal;
          return (
            <Pressable
              key={p}
              onPress={() => set(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.preset, { backgroundColor: on ? colors.text : colors.track }]}
            >
              <Text style={[type.labelS, { color: on ? colors.textInverse : colors.text }]}>{$(p)}</Text>
            </Pressable>
          );
        })}
      </View>

      {after !== null && before !== null ? (
        <View style={[styles.impact, infeasible && { backgroundColor: colors.warningFill }]}>
          <View style={styles.between}>
            <Text style={[type.labelS, { color: infeasible ? colors.text : colors.info }]}>Daily allowance</Text>
            <View style={styles.impactValues}>
              {after !== before ? (
                <>
                  <Text style={[type.label, styles.strike]}>{$(before)}</Text>
                  <ArrowRight size={16} color={colors.info} />
                </>
              ) : null}
              <Crossfade value={`${$(after)}/day`} />
            </View>
          </View>
          <Text style={[type.paragraph, { color: infeasible ? colors.text : colors.info }]}>
            {infeasible
              ? 'That leaves nothing for day-to-day spending this month.'
              : delta === 0
                ? `That's ${$(after)} a day for the ${daysLeft} days left.`
                : delta > 0
                  ? `Saving ${$(delta)} more means about ${$(perDay)} less to spend each day for the ${daysLeft} days left.`
                  : `Saving ${$(-delta)} less gives you about ${$(perDay)} more each day for the ${daysLeft} days left.`}
          </Text>
        </View>
      ) : null}

      <View>
        <View style={[styles.planRow, { height: 52 }]}>
          <View>
            <Text style={[type.labelS, { color: colors.textSubtle }]}>Income</Text>
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="link" hitSlop={8}>
              <Text style={[type.caption, { color: colors.textIgnored }]}>
                {data.plan.usingIncomeOverride ? 'Set manually' : 'Avg of last 3 months'} ·{' '}
                <Text style={{ textDecorationLine: 'underline' }}>Edit</Text>
              </Text>
            </Pressable>
          </View>
          <Text style={[type.labelS, styles.num]}>{$(data.plan.income)}</Text>
        </View>
        <PlanRow label="Bills & subscriptions" value={`−${$(billsReserved(data))}`} />
        <PlanRow label="Savings goal" value={`−${$(goal)}`} color={colors.brandText} />
        <View style={[styles.planRow, styles.total]}>
          <Text style={type.label}>Flexible spending</Text>
          <Text style={[type.label, styles.num, { color: flexible > 0 ? colors.success : colors.warning }]}>{$(flexible)}</Text>
        </View>
      </View>

      <View style={{ gap: space(2) }}>
        {failed ? <Text style={[type.caption, { color: colors.warning }]}>Couldn&apos;t save. Try again.</Text> : null}
        <Button label="Save goal" onPress={() => void save()} loading={saving} disabled={goal === was} />
      </View>
    </ScrollView>
  );
}

function PlanRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.planRow}>
      <Text style={[type.labelS, { color: colors.textSubtle }]}>{label}</Text>
      <Text style={[type.labelS, styles.num, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

/** 150 ms crossfade when the new allowance changes. */
function Crossfade({ value }: { value: string }) {
  const o = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    o.setValue(0.2);
    Animated.timing(o, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [value, o]);
  return <Animated.Text style={[type.headingXS, styles.num, { opacity: o }]}>{value}</Animated.Text>;
}

/** 44 round stepper; long-press repeats every 120 ms after 400 ms. */
function StepButton({ icon: Icon, label, onStep }: { icon: typeof Plus; label: string; onStep: () => void }) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const step = useRef(onStep);
  step.current = onStep;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <Pressable
      onPress={() => step.current()}
      onLongPress={() => {
        stop();
        timer.current = setInterval(() => step.current(), 120);
      }}
      delayLongPress={400}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, pressed && { backgroundColor: colors.rowPressed }]}
    >
      <Icon size={20} color={colors.text} />
    </Pressable>
  );
}

/** 6 px track, white fill, 28 px thumb; drag snaps to $50 (haptic per step via onChange). */
function Slider({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(0);
  const cfg = useRef({ width, max, onChange });
  cfg.current = { width, max, onChange };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => drag(e.nativeEvent.locationX),
      onPanResponderMove: (e) => drag(e.nativeEvent.locationX),
    }),
  ).current;
  function drag(x: number) {
    const { width: w, max: m, onChange: change } = cfg.current;
    if (w <= 0 || m <= 0) return;
    change(Math.min(m, Math.max(0, (x / w) * m)));
  }
  const frac = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.slider}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Savings goal"
      accessibilityValue={{ text: `${$(value)} per month` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(value + (e.nativeEvent.actionName === 'increment' ? STEP : -STEP))}
      {...pan.panHandlers}
    >
      <View style={styles.sliderTrack} pointerEvents="none">
        <View style={[styles.sliderFill, { width: `${frac * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: frac * width - 14 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.card },
  content: { paddingTop: space(6), paddingHorizontal: space(4), paddingBottom: space(10), gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slider: { height: 28, justifyContent: 'center' },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  sliderFill: { height: 6, backgroundColor: colors.text },
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.text,
    shadowColor: colors.thumbShadow,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  presets: { flexDirection: 'row', gap: space(2) },
  preset: { flex: 1, height: 36, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  impact: { backgroundColor: colors.infoFill, borderRadius: radius.md, padding: space(4), gap: space(2) },
  impactValues: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  strike: { color: colors.textIgnored, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40 },
  total: { borderTopWidth: 1, borderTopColor: colors.divider },
  num: { fontVariant: ['tabular-nums'] },
});
