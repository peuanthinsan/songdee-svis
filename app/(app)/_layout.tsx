import { Tabs } from 'expo-router';
import { useI18n } from '../../lib/i18n-context';
import { useRole } from '../../lib/useRole';
import { colors } from '../../constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function AppLayout() {
  const { t } = useI18n();
  const { isDriver, isAdmin } = useRole();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarLabel: t('nav.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: t('nav.vehicles'),
          tabBarLabel: t('nav.vehicles'),
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('nav.dashboard'),
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
          href: isDriver ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: t('nav.issues'),
          tabBarLabel: t('nav.issues'),
          tabBarIcon: ({ color, size }) => <Ionicons name="warning-outline" size={size} color={color} />,
          href: isDriver ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('nav.admin'),
          tabBarLabel: t('nav.admin'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          href: isAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
