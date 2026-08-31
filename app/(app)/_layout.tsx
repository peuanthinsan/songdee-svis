import { Tabs } from 'expo-router';
import { useI18n } from '../../lib/i18n-context';
import { useRole } from '../../lib/useRole';
import { useCompanyTheme } from '../../lib/use-company-theme';
import { density } from '../../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppLayout() {
  const { t } = useI18n();
  const { isDriver, isAdmin } = useRole();
  const colors = useCompanyTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          // edgeToEdgeEnabled lets Android draw behind the navigation bar, so
          // reserve the bottom inset explicitly instead of letting system
          // buttons cover the tab labels.
          height: density.tabBarHeight + insets.bottom,
          paddingTop: 4,
          paddingBottom: 10 + insets.bottom,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: t('nav.vehicles'),
          tabBarLabel: t('nav.vehicles'),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'car' : 'car-outline'} size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('nav.dashboard'),
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={21} color={color} />,
          href: isDriver ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: t('nav.export'),
          tabBarLabel: t('nav.export'),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'download' : 'download-outline'} size={21} color={color} />,
          href: isDriver ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: t('nav.issues'),
          tabBarLabel: t('nav.issues'),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'warning' : 'warning-outline'} size={21} color={color} />,
          href: isDriver ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('nav.admin'),
          tabBarLabel: t('nav.admin'),
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={21} color={color} />,
          href: isAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
