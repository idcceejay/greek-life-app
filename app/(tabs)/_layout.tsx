import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useSession } from '../../lib/useSession';
import { colors, iconSize } from '../../lib/theme';
import { Icon, IconName } from '../../components/ui';

/**
 * 5-tab bar per the UI Layout PDF: Map · Chats · Home · Calendar · Feed.
 * Home is a normal tab (it's a place, not an action), so all five share one
 * style: Ionicons outline when idle, filled when selected. The icon is
 * decorative — the tab's `title` is its accessible name.
 */
function TabIcon({ focused, color, name }: { focused: boolean; color: string; name: IconName }) {
  const icon = (focused ? name : `${name}-outline`) as IconName;
  return <Icon name={icon} size={iconSize.tab} color={color} />;
}

export default function TabLayout() {
  const { configured, loading, session, profile } = useSession();

  if (!configured) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas, padding: 24 }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.ink, textAlign: 'center' }}>
          Rally isn't configured
        </Text>
        <Text style={{ fontSize: 15, color: colors.inkSecondary, textAlign: 'center', marginTop: 8 }}>
          This build is missing its server settings. Reinstall the latest build.
        </Text>
      </View>
    );
  }

  {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!profile) return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.separator,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{ title: 'Map', tabBarIcon: (p) => <TabIcon {...p} name="map" /> }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: 'Chats', tabBarIcon: (p) => <TabIcon {...p} name="chatbubbles" /> }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: (p) => <TabIcon {...p} name="home" /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: (p) => <TabIcon {...p} name="calendar" /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: 'Feed', tabBarIcon: (p) => <TabIcon {...p} name="newspaper" /> }}
      />
    </Tabs>
  );
}
