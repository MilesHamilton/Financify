import type { AccountGroup, AccountSummary } from '@contract';
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  HandCoins,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Divider } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { money } from '@/lib/format';

type Row = { key: string; label: string; icon: LucideIcon; total: number; accounts?: AccountSummary[]; color?: string };

const sum = (list: AccountSummary[]) => list.reduce((s, a) => s + a.balance, 0);

/** RM dashboard ACCOUNTS card: Checking / Card Balance / Net Cash, then Savings / Investments / Loans. */
export function AccountsCard({ accounts }: { accounts: AccountSummary[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const by = (g: AccountGroup) => accounts.filter((a) => a.group === g);
  const row = (key: AccountGroup, label: string, icon: LucideIcon): Row[] => {
    const list = by(key);
    return list.length ? [{ key, label, icon, total: sum(list), accounts: list }] : [];
  };

  const checking = by('checking');
  const credit = by('credit');
  const cash: Row[] = [
    ...row('checking', 'Checking', Landmark),
    ...row('credit', 'Card Balance', CreditCard),
    ...(checking.length || credit.length
      ? [{ key: 'net', label: 'Net Cash', icon: Wallet, total: sum(checking) - sum(credit), color: colors.success }]
      : []),
  ];
  const other: Row[] = [
    ...row('savings', 'Savings', PiggyBank),
    ...row('investment', 'Investments', TrendingUp),
    ...row('loan', 'Loans', HandCoins),
    ...row('other', 'Other', Wallet),
  ];

  const renderGroup = (rows: Row[]) =>
    rows.length ? (
      <Card style={{ paddingVertical: space(1) }}>
        {rows.map((r, i) => {
          const expanded = open === r.key;
          const Chevron = expanded ? ChevronDown : ChevronRight;
          return (
            <Fragment key={r.key}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                disabled={!r.accounts}
                onPress={() => setOpen(expanded ? null : r.key)}
                accessibilityRole="button"
                accessibilityLabel={`${r.label} ${money(r.total)}`}
                accessibilityState={r.accounts ? { expanded } : undefined}
                style={styles.row}
              >
                <r.icon size={20} color={colors.textSubtle} />
                <Text style={[type.label, { flex: 1 }]}>{r.label}</Text>
                <Text style={[type.label, r.color ? { color: r.color } : null]}>{money(r.total)}</Text>
                {r.accounts ? <Chevron size={18} color={colors.textSubtle} /> : <View style={{ width: 18 }} />}
              </Pressable>
              {expanded
                ? r.accounts?.map((a) => (
                    <View key={a.id} style={styles.sub}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={type.labelS} numberOfLines={1}>
                          {a.name}
                        </Text>
                        <Text style={[type.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                          {a.institutionName}
                          {a.mask ? ` ··${a.mask}` : ''}
                          {a.itemStatus !== 'active' ? ' · Needs attention' : ''}
                        </Text>
                      </View>
                      <Text style={type.labelS}>{money(a.balance)}</Text>
                    </View>
                  ))
                : null}
            </Fragment>
          );
        })}
      </Card>
    ) : null;

  return (
    <View style={{ gap: space(3) }}>
      {renderGroup(cash)}
      {renderGroup(other)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingLeft: space(8), paddingVertical: space(2) },
});
