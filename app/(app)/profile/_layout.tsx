import { Stack } from 'expo-router';
import { useI18n } from '../../../lib/i18n-context';
import { useCompanyTheme } from '../../../lib/use-company-theme';
import { HeaderLogo } from '../../../components/HeaderLogo';

export default function ProfileLayout() {
  const { t } = useI18n();
  const colors = useCompanyTheme();
  return (
    <Stack screenOptions={{
      headerTintColor: colors.onPrimary,
      headerTitleStyle: { fontSize: 17, fontWeight: '700' },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerStyle: { backgroundColor: colors.primary },
      headerRight: () => <HeaderLogo />,
    }}>
      <Stack.Screen name="index" options={{ title: t('nav.profile') }} />
    </Stack>
  );
}
