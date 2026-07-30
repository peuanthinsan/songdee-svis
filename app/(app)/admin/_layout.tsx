import { Stack } from 'expo-router';
import { colors } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { HeaderLogo } from '../../../components/HeaderLogo';

export default function AdminLayout() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.onPrimary,
      headerTitleStyle: { fontWeight: '700' },
      headerRight: () => <HeaderLogo />,
    }}>
      <Stack.Screen name="index" options={{ title: t('nav.admin') }} />
      <Stack.Screen name="users" options={{ title: t('admin.hub.users') }} />
      <Stack.Screen name="vehicles" options={{ title: t('admin.hub.vehicles') }} />
      <Stack.Screen name="fleets" options={{ title: t('admin.hub.fleets') }} />
      <Stack.Screen name="issues" options={{ title: t('admin.hub.issues') }} />
      <Stack.Screen name="analytics" options={{ title: t('admin.hub.analytics') }} />
      <Stack.Screen name="checklist" options={{ title: t('admin.hub.checklist') }} />
    </Stack>
  );
}
