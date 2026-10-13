import type { Category, Txn } from '@contract';
import { View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { MerchantLogo } from '@/components/MerchantLogo';
import { ListRow, PressableRow } from '@/components/ui';
import { colors } from '@/constants/theme';
import { money, shortDate } from '@/lib/format';

export function CategoryBadge({ category, size = 36 }: { category: Category; size?: number }) {
  return <CategoryIcon icon={category.icon} color={category.color} size={size} />;
}

export const txnTitle = (t: Txn) => t.merchantName ?? t.name;

/** Income (negative amount) shows as +$X; spend as $X. */
export const txnAmount = (t: Txn) => (t.amount < 0 ? `+${money(-t.amount)}` : money(t.amount));

/** `showDate` swaps the account name for the date — for lists that aren't grouped by day. */
export function TransactionRow({ txn, onPress, showDate = false }: { txn: Txn; onPress?: () => void; showDate?: boolean }) {
  const title = txnTitle(txn);
  const amount = txnAmount(txn);
  const row = (
    <View style={{ opacity: txn.isExcluded ? 0.5 : 1 }}>
      <ListRow
        leading={<MerchantLogo uri={txn.logoUrl} name={title} fallback={<CategoryBadge category={txn.category} />} />}
        title={title}
        subtitle={`${txn.category.label} · ${showDate ? shortDate(txn.date) : txn.accountName}`}
        value={amount}
        valueColor={txn.pending ? colors.textSubtle : txn.amount < 0 ? colors.success : undefined}
        valueSubtitle={txn.pending ? 'Pending' : undefined}
      />
    </View>
  );
  if (!onPress) return row;
  return (
    <PressableRow
      onPress={onPress}
      accessibilityLabel={`${title}, ${amount}${txn.pending ? ', pending' : ''}${txn.isExcluded ? ', ignored' : ''}`}
    >
      {row}
    </PressableRow>
  );
}
