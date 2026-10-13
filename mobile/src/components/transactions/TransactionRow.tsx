import type { Category, Txn } from '@contract';
import { Pressable, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { MerchantLogo } from '@/components/MerchantLogo';
import { ListRow } from '@/components/ui';
import { colors } from '@/constants/theme';
import { money } from '@/lib/format';


export function CategoryBadge({ category, size = 36 }: { category: Category; size?: number }) {
  return <CategoryIcon icon={category.icon} color={category.color} size={size} />;
}

export const txnTitle = (t: Txn) => t.merchantName ?? t.name;

/** Income (negative amount) shows as +$X; spend as $X. */
export const txnAmount = (t: Txn) => (t.amount < 0 ? `+${money(-t.amount)}` : money(t.amount));

export function TransactionRow({ txn, onPress }: { txn: Txn; onPress?: () => void }) {
  const title = txnTitle(txn);
  const amount = txnAmount(txn);
  const row = (
    <View style={{ opacity: txn.isExcluded ? 0.5 : 1 }}>
      <ListRow
        leading={txn.logoUrl ? <MerchantLogo uri={txn.logoUrl} name={title} /> : <CategoryBadge category={txn.category} />}
        title={title}
        subtitle={`${txn.category.label} · ${txn.accountName}`}
        value={amount}
        valueColor={txn.pending ? colors.textSubtle : txn.amount < 0 ? colors.success : undefined}
        valueSubtitle={txn.pending ? 'Pending' : undefined}
      />
    </View>
  );
  if (!onPress) return row;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${amount}${txn.pending ? ', pending' : ''}${txn.isExcluded ? ', ignored' : ''}`}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      {row}
    </Pressable>
  );
}
