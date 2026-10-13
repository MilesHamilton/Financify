import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

/** Merchant logo in a circle; falls back to the first letter on a neutral fill. */
export function MerchantLogo({ uri, name, size = 36 }: { uri: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return <Image source={{ uri }} style={[box, { backgroundColor: '#fff' }]} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[box, { backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.text, fontSize: size * 0.42, fontWeight: '600' }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}
