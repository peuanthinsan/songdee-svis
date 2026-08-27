import { Stack } from 'expo-router';
import { useI18n } from '../../../lib/i18n-context';
import { useCompanyTheme } from '../../../lib/use-company-theme';
import { HeaderLogo } from '../../../components/HeaderLogo';

export default function ExportLayout() {
  const { t } = useI18n();
  const theme = useCompanyTheme();
  return <Stack screenOptions={{ headerStyle: { backgroundColor: theme.primary }, headerTintColor: theme.onPrimary, headerTitleStyle: { fontSize: 17, fontWeight: '700' }, headerShadowVisible: false, headerRight: () => <HeaderLogo /> }}><Stack.Screen name="index" options={{ title: t('nav.export') }} /></Stack>;
}
