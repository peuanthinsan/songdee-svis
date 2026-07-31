import { Stack } from 'expo-router';
import { useI18n } from '../../../../lib/i18n-context';
import { useCompanyTheme } from '../../../../lib/use-company-theme';

export default function VehicleDetailLayout() {
  const { t } = useI18n();
  const colors = useCompanyTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontSize: 17, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: t('vehicles.title') }} />
      <Stack.Screen name="inspect" options={{ title: t('inspection.daily') }} />
    </Stack>
  );
}
