import { Stack } from 'expo-router';
import { colors } from '../../../../constants/theme';
import { useI18n } from '../../../../lib/i18n-context';

export default function VehicleDetailLayout() {
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('vehicles.title') }} />
      <Stack.Screen name="inspect" options={{ title: t('inspection.daily') }} />
    </Stack>
  );
}
