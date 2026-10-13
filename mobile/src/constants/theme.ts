/**
 * Dark theme. Neutral surfaces and the type scale follow the Rocket Money
 * capture (docs/rocket-clone/rm-capture.md §3); RM's brand red scale is
 * replaced step-for-step by the blue scale below.
 */
export const blue = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
  600: '#2563EB',
  700: '#1D4ED8',
  800: '#1E40AF',
} as const;

export const colors = {
  bg: '#1B1B1B',
  card: '#2B2B2B',
  cardSubtle: '#242424',
  accentFill: '#404040',
  border: '#545454',
  divider: '#454545',
  text: '#FFFFFF',
  textSubtle: '#C1C1C1',
  textIgnored: '#949494',
  textDisabled: '#7B7B7B',
  textInverse: '#111111',
  brand: blue[500],
  brandText: blue[400],
  brandBold: blue[300],
  brandFill: blue[600],
  brandPressed: blue[800],
  success: '#94CFAD',
  successFill: '#0B5E36',
  warning: '#FF9124',
  warningFill: '#C25400',
  info: '#ADC6F6',
  infoFill: '#2A396F',
  chartLine: '#7392FC',
  chartArea: '#323F6B',
  chartSecondary: '#3953AB',
  chartAxis: '#7B7B7B',
  track: 'rgba(255,255,255,0.15)',
  scrim: 'rgba(0,0,0,0.8)',
  skeleton: 'rgba(255,255,255,0.1)',
  tabBar: '#2B2B2B',
  tabBarBorder: '#4D4D4D',
  tabInactive: '#6D6D6D',
  input: '#404040',
} as const;

export const radius = { sm: 6, banner: 8, md: 16, lg: 24, round: 9999 } as const;

/** 4-pt helper; screen gutter is space(4) = 16. */
export const space = (n: number) => n * 4;

type Weight = '400' | '500' | '600';
const t = (fontSize: number, lineHeight: number, fontWeight: Weight, letterSpacing = 0) => ({
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  color: colors.text,
});

/** RM text styles (§3.4) on the system font (SF Pro) — RM's WNTL Text is licensed. */
export const type = {
  headingXXL: t(48, 56, '500', -1),
  headingXL: t(36, 44, '500', -1),
  headingL: t(32, 40, '500', -1),
  heading: t(28, 36, '500', -1),
  headingS: t(24, 32, '500'),
  headingXS: t(20, 28, '500'),
  headingXXS: t(18, 24, '500'),
  labelL: t(18, 24, '500'),
  label: t(16, 24, '500'),
  labelS: t(14, 20, '500'),
  paragraphXL: t(18, 28, '400'),
  paragraphL: t(16, 24, '400'),
  paragraph: t(14, 20, '400'),
  caption: t(12, 16, '400'),
  captionS: t(10, 15, '400'),
  tracked: { ...t(12, 12, '500', 0.6), textTransform: 'uppercase' as const },
} as const;
