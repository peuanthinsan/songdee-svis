import { brand } from '../branding';

export const colors = {
  primary: brand.primary,
  accent: brand.accent,
  onPrimary: brand.primaryText,
  white: '#FFFFFF',
  background: '#F5F5F5',
  cardBackground: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#999999',
  statusPass: '#22C55E',
  statusFail: '#EF4444',
  statusPending: '#F59E0B',
  statusChecked: '#22C55E',
  statusInProgress: '#F59E0B',
  border: '#E5E5E5',
  inputBackground: '#F5F5F5',
  shadow: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
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
