import type { RecapResponse } from '@contract';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MerchantLogo } from '@/components/MerchantLogo';
import { addMonths } from '@/components/spending/month';
import { Button, ErrorState, Money } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { money, parseDay } from '@/lib/format';
import { useReduceMotion } from '@/lib/motion';
import { isRecapScheduled, scheduleMonthlyRecap } from '@/lib/recap-reminder';
import { useToast } from '@/lib/toast';
import { useApi } from '@/lib/use-api';

const SLIDE_MS = 6500;

type Slide = { key: string; bg: [string, string]; body: ReactNode };

/**
 * Monthly "Wrapped"-style recap: full-screen story slides that auto-advance.
 * Tap right/left to skip, hold to pause.
 */
export default function Recap() {
  const { month } = useLocalSearchParams<{ month?: string }>();
  const { data, error, refresh } = useApi<RecapResponse>(`/api/mobile/recap${month ? `?month=${month}` : ''}`);
  const insets = useSafeAreaInsets();

  if (error)
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <CloseButton />
        <ErrorState onRetry={refresh} />
      </View>
    );
  if (!data)
    return (
      <LinearGradient colors={['#0B1530', '#1E40AF']} style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.text} />
      </LinearGradient>
    );
  return <Stories slides={buildSlides(data)} />;
}

function Stories({ slides }: { slides: Slide[] }) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [idx, setIdx] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const held = useRef(false);
  const pos = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => (pos.current = value));
    return () => progress.removeListener(id);
  }, [progress]);
  const last = slides.length - 1;

  const run = () => {
    if (reduce || idx >= last) return;
    const left = (1 - pos.current) * SLIDE_MS;
    Animated.timing(progress, { toValue: 1, duration: left, useNativeDriver: false }).start(({ finished }) => {
      if (finished) setIdx((i) => Math.min(i + 1, last));
    });
  };

  useEffect(() => {
    progress.setValue(0);
    pos.current = 0;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: reduce ? 0 : 420, useNativeDriver: true }).start();
    run();
    return () => progress.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, reduce]);

  const go = (d: number) => {
    const next = Math.max(0, Math.min(last, idx + d));
    if (next !== idx) {
      void Haptics.selectionAsync();
      setIdx(next);
    }
  };

  const slide = slides[idx];
  return (
    <LinearGradient colors={slide.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
      <Pressable
        style={styles.fill}
        onPressIn={() => progress.stopAnimation()}
        onLongPress={() => (held.current = true)}
        onPressOut={() => {
          if (held.current) {
            held.current = false;
            run();
          }
        }}
        onPress={(e) => {
          if (e.nativeEvent.locationX < 120) go(-1);
          else if (idx < last) go(1);
          else run();
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={`Recap, slide ${idx + 1} of ${slides.length}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => go(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <View style={[styles.top, { paddingTop: insets.top + space(2) }]}>
          <View style={styles.segments}>
            {slides.map((s, i) => (
              <View key={s.key} style={styles.segment}>
                <Animated.View
                  style={[
                    styles.segmentFill,
                    {
                      width:
                        i < idx
                          ? '100%'
                          : i > idx
                            ? '0%'
                            : reduce || idx === last
                              ? '100%'
                              : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <CloseButton />
        </View>

        <Animated.View
          key={slide.key}
          style={[
            styles.body,
            { paddingBottom: insets.bottom + space(8) },
            { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
          ]}
        >
          {slide.body}
        </Animated.View>
      </Pressable>
    </LinearGradient>
  );
}

function CloseButton() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close recap" style={styles.close}>
      <X size={18} color={colors.text} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

const monthName = (m: string) => parseDay(`${m}-01`).toLocaleDateString('en-US', { month: 'long' });
const pct = (n: number) => `${Math.abs(n)}%`;

function buildSlides(r: RecapResponse): Slide[] {
  const name = monthName(r.month);
  const s: Slide[] = [];

  s.push({
    key: 'intro',
    bg: ['#0B1530', '#1E40AF'],
    body: (
      <>
        <Image source={require('../../assets/logo-mark.png')} style={styles.mark} accessibilityIgnoresInvertColors />
        <Eyebrow>Financify Recap</Eyebrow>
        <Text style={styles.huge}>Your {name},{'\n'}unwrapped.</Text>
        <Sub>{r.transactionCount} purchases. Let's see where it all went.</Sub>
      </>
    ),
  });

  s.push({
    key: 'total',
    bg: ['#1D4ED8', '#0B1530'],
    body: (
      <>
        <Eyebrow>In {name} you spent</Eyebrow>
        <Money value={r.totalSpent} size="xxl" cents={false} countUp={900} />
        {r.changePct !== null ? (
          <Sub>
            That's <Text style={styles.em}>{pct(r.changePct)} {r.changePct <= 0 ? 'less' : 'more'}</Text> than{' '}
            {monthName(addMonths(r.month, -1))}.
          </Sub>
        ) : null}
        <View style={styles.split}>
          <Stat label="Fixed costs" value={money(r.fixedSpent, true)} />
          <Stat label="Lifestyle" value={money(r.lifestyleSpent, true)} />
        </View>
      </>
    ),
  });

  if (r.topCategories.length)
    s.push({
      key: 'categories',
      bg: ['#312E81', '#1E40AF'],
      body: (
        <>
          <Eyebrow>Your lifestyle went to</Eyebrow>
          <Text style={styles.big}>{r.topCategories[0].label}</Text>
          <Sub>
            <Text style={styles.em}>{r.topCategories[0].sharePct}%</Text> of everything you chose to spend.
          </Sub>
          <View style={styles.bars}>
            {r.topCategories.map((c, i) => (
              <View key={c.id} style={{ gap: space(2) }}>
                <View style={styles.barLabel}>
                  <Text style={[type.label, { color: colors.text }]}>
                    {i + 1}. {c.label}
                  </Text>
                  <Text style={[type.label, styles.num]}>{money(c.spent, true)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(4, c.sharePct)}%`, backgroundColor: c.color }]} />
                </View>
              </View>
            ))}
          </View>
        </>
      ),
    });

  if (r.topMerchant)
    s.push({
      key: 'merchant',
      bg: ['#0E7490', '#1E3A8A'],
      body: (
        <>
          <MerchantLogo uri={r.topMerchant.logoUrl} name={r.topMerchant.name} size={72} />
          <Eyebrow>Your top spot</Eyebrow>
          <Text style={styles.big}>{r.topMerchant.name}</Text>
          <Sub>
            <Text style={styles.em}>{money(r.topMerchant.spent, true)}</Text> across {plural(r.topMerchant.count, 'visit')}.
          </Sub>
          {r.mostVisited ? (
            <View style={styles.callout}>
              <MerchantLogo uri={r.mostVisited.logoUrl} name={r.mostVisited.name} size={36} />
              <Text style={[type.paragraphL, { color: colors.text, flex: 1 }]}>
                But your real regular? <Text style={styles.em}>{r.mostVisited.name}</Text>, {plural(r.mostVisited.count, 'time')}.
              </Text>
            </View>
          ) : null}
        </>
      ),
    });

  if (r.biggestPurchase)
    s.push({
      key: 'biggest',
      bg: ['#1E40AF', '#6D28D9'],
      body: (
        <>
          <Eyebrow>Biggest splurge</Eyebrow>
          <Money value={r.biggestPurchase.amount} size="xxl" countUp={900} />
          <Sub>
            <Text style={styles.em}>{r.biggestPurchase.name}</Text> on{' '}
            {parseDay(r.biggestPurchase.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
          </Sub>
        </>
      ),
    });

  s.push({
    key: 'habits',
    bg: ['#0F172A', '#2563EB'],
    body: (
      <>
        <Eyebrow>Your habits</Eyebrow>
        {r.busiestWeekday ? (
          <Text style={styles.big}>
            {r.busiestWeekday.name}s{'\n'}were your weakness.
          </Text>
        ) : null}
        <View style={styles.grid}>
          <Tile value={String(r.noSpendDays)} label="no-spend days" />
          {r.daysUnderAllowance !== null ? (
            <Tile value={`${r.daysUnderAllowance}/${r.daysInMonth}`} label="days under your daily allowance" />
          ) : null}
          {r.busiestWeekday ? <Tile value={money(r.busiestWeekday.spent, true)} label={`spent on ${r.busiestWeekday.name}s`} /> : null}
        </View>
      </>
    ),
  });

  const hit = r.savingsTarget > 0 && r.saved >= r.savingsTarget;
  s.push({
    key: 'savings',
    bg: r.saved >= 0 ? ['#065F46', '#1E40AF'] : ['#7C2D12', '#1E3A8A'],
    body: (
      <>
        <Eyebrow>{r.saved >= 0 ? 'You kept' : 'You overspent by'}</Eyebrow>
        <Money value={Math.abs(r.saved)} size="xxl" cents={false} countUp={900} />
        {r.savingsRatePct !== null && r.saved >= 0 ? (
          <Sub>
            <Text style={styles.em}>{r.savingsRatePct}%</Text> of the {money(r.income, true)} you earned.
          </Sub>
        ) : null}
        {r.savingsTarget > 0 ? (
          <View style={styles.callout}>
            <Text style={[type.paragraphL, { color: colors.text, flex: 1 }]}>
              {hit
                ? `Goal crushed: ${money(r.saved - r.savingsTarget, true)} past your ${money(r.savingsTarget, true)} target.`
                : `${money(Math.max(0, r.savingsTarget - r.saved), true)} short of your ${money(r.savingsTarget, true)} goal. Daily Spend can close that gap.`}
            </Text>
          </View>
        ) : null}
      </>
    ),
  });

  s.push({
    key: 'persona',
    bg: ['#1E40AF', '#0B1530'],
    body: <PersonaSlide r={r} name={name} />,
  });

  return s;
}

function PersonaSlide({ r, name }: { r: RecapResponse; name: string }) {
  const [scheduled, setScheduled] = useState<boolean | null>(null);
  useEffect(() => {
    void isRecapScheduled().then(setScheduled).catch(() => setScheduled(false));
  }, []);

  const share = () =>
    void Share.share({
      message: `My ${name} on Financify: I'm "${r.persona.title}". Spent ${money(r.totalSpent, true)}, ${
        r.saved >= 0 ? `kept ${money(r.saved, true)}` : `overspent ${money(-r.saved, true)}`
      }${r.topCategories[0] ? `, mostly on ${r.topCategories[0].label.toLowerCase()}` : ''}.`,
    });

  const remind = async () => {
    const ok = await scheduleMonthlyRecap().catch(() => false);
    setScheduled(ok);
    useToast.getState().show(ok ? "We'll have your recap ready on the 1st." : 'Turn on notifications in Settings to get reminders.');
  };

  return (
    <>
      <Eyebrow>Your {name} persona</Eyebrow>
      <Text style={styles.huge}>{r.persona.title}</Text>
      <Sub>{r.persona.blurb}</Sub>
      <View style={styles.actions}>
        <Button label="Share my recap" onPress={share} />
        {scheduled === false ? <Button label="Remind me every month" variant="secondary" onPress={() => void remind()} /> : null}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

const Eyebrow = ({ children }: { children: ReactNode }) => <Text style={styles.eyebrow}>{children}</Text>;
const Sub = ({ children }: { children: ReactNode }) => <Text style={styles.sub}>{children}</Text>;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: space(1) }}>
      <Text style={[type.caption, { color: colors.textOnBand }]}>{label}</Text>
      <Text style={[type.headingXS, styles.num]}>{value}</Text>
    </View>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[type.heading, styles.num]}>{value}</Text>
      <Text style={[type.paragraph, { color: colors.textOnBand }]}>{label}</Text>
    </View>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4) },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  segmentFill: { height: 3, backgroundColor: colors.text },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space(6), gap: space(4) },
  mark: { width: 64, height: 64, marginBottom: space(2) },
  eyebrow: { ...type.tracked, color: colors.textOnBand },
  huge: { ...type.headingXL, fontWeight: '600' },
  big: { ...type.headingL, fontWeight: '600' },
  sub: { ...type.paragraphXL, color: colors.textOnBand },
  em: { color: colors.text, fontWeight: '600' },
  num: { color: colors.text, fontVariant: ['tabular-nums'] },
  split: {
    flexDirection: 'row',
    gap: space(4),
    marginTop: space(4),
    paddingTop: space(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderTranslucent,
  },
  bars: { gap: space(4), marginTop: space(4) },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    marginTop: space(4),
    padding: space(4),
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  grid: { gap: space(3), marginTop: space(2) },
  tile: { padding: space(4), borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)', gap: space(1) },
  actions: { gap: space(3), marginTop: space(6) },
});
