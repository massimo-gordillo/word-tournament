import { Tabs, Redirect, useRouter } from 'expo-router';
import { Home, Trophy, BarChart3, User, Settings } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import { AppColors } from '@/constants/colors';
import { AppFonts, FontSize } from '@/constants/typography';
import { copy } from '@/app/copy/strings';

export default function TabLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={AppColors.brand.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: AppColors.brand.primary,
        tabBarInactiveTintColor: AppColors.icon.subtle,
        tabBarStyle: {
          backgroundColor: AppColors.background.surface,
          borderTopWidth: 1,
          borderTopColor: AppColors.border.default,
          paddingTop: 8,
          paddingBottom: 16,
          height: 80,
        },
        tabBarLabelStyle: {
          fontFamily: AppFonts.medium,
          fontSize: FontSize.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: copy.tabs.submit,
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: copy.tabs.ongoing,
          tabBarIcon: ({ size, color }) => <Trophy size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: copy.tabs.manage,
          tabBarIcon: ({ size, color }) => <Settings size={size} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace({
              pathname: '/(tabs)/manage',
              params: { reset: Date.now().toString() },
            });
          },
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: copy.tabs.statistics,
          tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: copy.tabs.account,
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tournament/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="draft-tournament/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="open-source-licenses"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="privacy-policy"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
