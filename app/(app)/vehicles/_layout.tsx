import { Stack } from 'expo-router';
import { colors } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { HeaderLogo } from '../../../components/HeaderLogo';

export default function VehiclesLayout() {
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <HeaderLogo />,
      }}
    >
      <Stack.Screen name="index" options={{ title: t('nav.vehicles') }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
