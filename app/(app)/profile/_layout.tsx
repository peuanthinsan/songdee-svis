import { Stack } from 'expo-router';
import { colors } from '../../../constants/theme';
import { useI18n } from '../../../lib/i18n-context';
import { HeaderLogo } from '../../../components/HeaderLogo';

export default function ProfileLayout() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.onPrimary,
      headerTitleStyle: { fontWeight: '700' },
      headerRight: () => <HeaderLogo />,
    }}>
      <Stack.Screen name="index" options={{ title: t('nav.profile') }} />
    </Stack>
  );
}
