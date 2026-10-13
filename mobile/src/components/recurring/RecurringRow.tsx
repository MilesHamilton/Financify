import type { RecurringStream } from '@contract';
import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { MerchantLogo } from '@/components/MerchantLogo';
import { ListRow } from '@/components/ui';
import { colors } from '@/constants/theme';
import { money } from '@/lib/format';

import { FREQ_LABEL } from './utils';

/** RM RecurringChargeRow: logo, name, frequency, amount, due label. Opens the stream detail. */
export function RecurringRow({ stream, due }: { stream: RecurringStream; due?: string }) {
  const income = stream.direction === 'inflow';
  const amount = income ? `+${money(stream.amount)}` : money(stream.amount);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: stream.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${stream.name}, ${FREQ_LABEL[stream.frequency]}, ${amount}${due ? `, ${due}` : ''}`}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      <ListRow
        leading={<MerchantLogo uri={stream.logoUrl} name={stream.name} />}
        title={stream.name}
        subtitle={FREQ_LABEL[stream.frequency]}
        value={amount}
        valueColor={income ? colors.success : undefined}
        valueSubtitle={due}
        chevron
      />
    </Pressable>
  );
}
