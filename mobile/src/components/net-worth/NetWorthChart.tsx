import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { smoothPath } from '@/components/SpendChart';
import { colors } from '@/constants/theme';

/** Line + area chart of one net-worth series (oldest first). Scales to the series' own min/max so negatives work. */
export function NetWorthChart({ values, height = 160 }: { values: number[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const x = (i: number) => (values.length <= 1 ? width / 2 : (i / (values.length - 1)) * (width - 8) + 4);
  const y = (v: number) => height - ((v - min) / span) * (height - 16) - 8;

  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  const area = pts.length > 1 ? `${line} L${last[0]},${height} L${pts[0][0]},${height} Z` : '';

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
      accessible
      accessibilityLabel="Net worth history chart"
    >
      {width > 0 && last ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="nwArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.chartArea} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.chartArea} stopOpacity="0.15" />
            </LinearGradient>
          </Defs>
          {area ? <Path d={area} fill="url(#nwArea)" /> : null}
          <Path d={line} stroke={colors.chartLine} strokeWidth={3} fill="none" />
          <Circle cx={last[0]} cy={last[1]} r={5} fill={colors.text} />
        </Svg>
      ) : null}
    </View>
  );
}
