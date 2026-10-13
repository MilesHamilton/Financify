import type { TransactionsResponse, Txn } from '@contract';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, CircleCheck, Clock, Coffee, Info, TrendingUp } from 'lucide-react-native';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { $, dayTitle, monthName, useDailySpendStore } from '@/components/daily-spend/model';
import { MerchantLogo } from '@/components/MerchantLogo';
import { openTxn, txnTitle, useFreshTxns, useTxnStore } from '@/components/transactions';
import { Button, Chip, Divider, EmptyState, ErrorState, ListRow, Money, PressableRow, ProgressBar, SectionBand, SkeletonRow } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

/**
 * All of a month's transactions (the API has no date filter), paged until done.
 * shortcut: capped at 20 pages; add a `date` filter to /api/mobile/transactions if months get bigger.
 */
function useMonthTxns(month: string) {
  const [state, setState] = useState<{ month: string; txns: Txn[] | null; error: boolean }>({ month, txns: null, error: false });
  const put = useTxnStore((s) => s.put);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const all: Txn[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 20; page++) {
          const res: TransactionsResponse = await api<TransactionsResponse>(
            `/api/mobile/transactions?month=${month}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          );
          all.push(...res.transactions);
          cursor = res.nextCursor;
          if (!cursor) break;
        }
        if (!live) return;
        put(all);
        setState({ month, txns: all, error: false });
      } catch {
        if (live) setState({ month, txns: null, error: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [month, put, attempt]);
  return { ...(state.month === month ? state : { txns: null, error: false }), retry: () => setAttempt((a) => a + 1) };
}

/** Day detail sheet (spec §4): day nav, spent vs allowance, roll-forward note, that day's flexible spend. */
export default function DaySheet() {
  const params = useLocalSearchParams<{ date: string }>();
  const data = useDailySpendStore((s) => s.data);
  const [date, setDate] = useState(params.date);
  const month = date.slice(0, 7);
  const { txns, error, retry } = useMonthTxns(month);
  const fresh = useFreshTxns(txns ?? []);

  if (!data || data.month !== month) {
    return (
      <View style={styles.sheet}>
        <EmptyState icon={Coffee} title="Nothing to show" body="Open a day from the Daily tab." />
      </View>
    );
  }

  const idx = data.days.findIndex((d) => d.date === date);
  const day = data.days[idx];
  if (!day) return null;
  const canPrev = idx > 0;
  const canNext = idx < data.days.length - 1 && !data.days[idx + 1].isFuture;
  const step = (d: number) => {
    void Haptics.selectionAsync();
    setDate(data.days[idx + d].date);
  };

  const allowance = day.allowance;
  const over = allowance !== null && day.spent > allowance;
  const diff = allowance === null ? 0 : Math.abs(day.spent - allowance);
  const daysAfter = data.daysInMonth - day.day;
  const perDay = daysAfter > 0 ? diff / daysAfter : 0;
  const effect = perDay < 1 ? 'by a few cents' : `about ${$(perDay)}`;
  const note =
    day.isToday || allowance === null || daysAfter === 0 || diff < 1
      ? null
      : over
        ? `No stress — the extra ${$(diff)} was spread over the rest of ${monthName(month)}, so each later day dropped by ${effect}.`
        : `Nice — the ${$(diff)} you didn't spend was spread over the rest of ${monthName(month)}, adding ${perDay < 1 ? 'a few cents' : effect} to each later day.`;

  // shortcut: bill-matched txns can't be detected client-side; the band total uses the API's flexible figure.
  const rows = fresh.filter((t) => t.date === date && t.amount > 0 && !t.isExcluded && t.category.group === 'expense');

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={styles.content}>
      <View style={[styles.pad, styles.header]}>
        <View style={styles.nav}>
          <NavButton icon={ChevronLeft} label="Previous day" disabled={!canPrev} onPress={() => step(-1)} />
          <Text style={type.headingXS} accessibilityRole="header">
            {dayTitle(date)}
          </Text>
          <NavButton icon={ChevronRight} label="Next day" disabled={!canNext} onPress={() => step(1)} />
        </View>
        {day.isToday ? (
          <Chip variant="secondary" icon={Clock} label="Today" />
        ) : allowance === null ? null : over ? (
          <Chip variant="warning" icon={TrendingUp} label={`Over by ${$(diff)}`} />
        ) : (
          <Chip variant="success" icon={CircleCheck} label={`Under by ${$(diff)}`} />
        )}
      </View>

      <View style={[styles.pad, { gap: 10 }]}>
        <View style={styles.summary}>
          <Money value={day.spent} size="xxl" />
          {allowance !== null ? (
            <Text style={[type.paragraph, { color: colors.textSubtle, paddingBottom: 8 }]}>of {$(allowance)} allowance</Text>
          ) : null}
        </View>
        {allowance !== null ? <ProgressBar value={day.spent} max={allowance} /> : null}
      </View>

      {note ? (
        <View style={styles.pad}>
          <View style={styles.note}>
            <Info size={18} color={colors.info} />
            <Text style={[type.paragraph, { color: colors.textSubtle, flex: 1 }]}>{note}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.pad}>
        {error ? (
          <ErrorState onRetry={retry} />
        ) : !txns ? (
          <View style={{ gap: space(4) }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Coffee}
            title={`No spending on ${dayTitle(date)}`}
            body="Nothing counted toward your allowance this day."
          />
        ) : (
          <>
            <SectionBand title={`${rows.length} transaction${rows.length === 1 ? '' : 's'}`} detail={money(day.spent)} />
            {rows.map((t, i) => (
              <Fragment key={t.id}>
                {i > 0 ? <Divider inset={48} /> : null}
                <PressableRow onPress={() => openTxn(t)} accessibilityLabel={`${txnTitle(t)}, ${money(t.amount)}`}>
                  <ListRow
                    leading={
                      <MerchantLogo
                        uri={t.logoUrl}
                        name={txnTitle(t)}
                        fallback={<CategoryIcon icon={t.category.icon} color={t.category.color} />}
                      />
                    }
                    title={txnTitle(t)}
                    subtitle={t.category.label}
                    value={money(t.amount)}
                  />
                </PressableRow>
              </Fragment>
            ))}
          </>
        )}
      </View>

      <View style={styles.pad}>
        <Button
          label="View in Transactions"
          variant="secondary"
          onPress={() => {
            router.back();
            router.navigate({ pathname: '/transactions', params: { month } });
          }}
        />
      </View>
    </ScrollView>
  );
}

function NavButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof ChevronLeft;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.navBtn, pressed && { backgroundColor: colors.accentFill }]}
    >
      <Icon size={18} color={disabled ? colors.textDisabled : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.card },
  content: { paddingTop: space(6), paddingBottom: space(10), gap: space(5) },
  pad: { paddingHorizontal: space(4) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  nav: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.banner,
    backgroundColor: colors.cardSubtle,
  },
});
