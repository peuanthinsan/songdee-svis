import { brand } from '../branding';

export const colors = {
  primary: brand.primary,
  accent: brand.accent,
  onPrimary: brand.primaryText,
  white: '#FFFFFF',
  background: '#F3F5F7',
  cardBackground: '#FFFFFF',
  textPrimary: '#17212B',
  textSecondary: '#5F6B78',
  textTertiary: '#87919C',
  statusPass: '#22C55E',
  statusFail: '#EF4444',
  statusPending: '#F59E0B',
  statusChecked: '#22C55E',
  statusInProgress: '#F59E0B',
  border: '#D8DEE6',
  inputBackground: '#F7F8FA',
  shadow: '#000000',
} as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function normalizeColor(value: string | undefined, fallback: string) {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

function getReadableTextColor(backgroundColor: string) {
  const hex = backgroundColor.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkLuminance = 0.01033;
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);

  return darkContrast >= whiteContrast ? colors.textPrimary : colors.white;
}

export function createCompanyTheme(primaryColor?: string, accentColor?: string) {
  const primary = normalizeColor(primaryColor, colors.primary);
  const accent = normalizeColor(accentColor, colors.accent);

  return {
    ...colors,
    primary,
    accent,
    onPrimary: getReadableTextColor(primary),
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 2,
    elevation: 0,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;

export const density = {
  screenPadding: 12,
  sectionGap: 12,
  controlHeight: 44,
  rowMinHeight: 52,
  headerHeight: 52,
  tabBarHeight: 72,
} as const;

export const statusColors = {
  pass: { bg: '#E8F5E9', text: '#2E7D32' },
  fail: { bg: '#FFF3E0', text: '#E65100' },
  pending: { bg: '#FFF8E1', text: '#F57F17' },
} as const;

export const typography = {
  h1: { fontSize: 24, fontWeight: '800' as const },
  h2: { fontSize: 18, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

export const modalOverlay = 'rgba(0,0,0,0.5)';
