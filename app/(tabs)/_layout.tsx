import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../lib/theme';

/**
 * 5-tab bar per the UI Layout PDF: Map · Chats · Home (raised center) · Calendar · Feed.
 * Icons are simple glyph placeholders until an icon set is chosen.
 */
function GlyphIcon({ focused, glyph }: { focused: boolean; glyph: string }) {
  return (
    <View style={[s.icon, { backgroundColor: focused ? colors.accent : colors.separator }]}>
      <Text style={{ fontSize: 11, color: focused ? '#fff' : colors.inkSecondary }}>{glyph}</Text>
    </View>
  );
}

function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[s.homeIcon, { backgroundColor: focused ? colors.accent : colors.accentSoft }]}>
      <View style={[s.homeDot, { backgroundColor: focused ? '#fff' : colors.accent }]} />
    </View>
  );
}

export default function TabLayout() {
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
        options={{ title: 'Map', tabBarIcon: ({ focused }) => <GlyphIcon focused={focused} glyph="◉" /> }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: 'Chats', tabBarIcon: ({ focused }) => <GlyphIcon focused={focused} glyph="✉" /> }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <HomeIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: ({ focused }) => <GlyphIcon focused={focused} glyph="▦" /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: 'Feed', tabBarIcon: ({ focused }) => <GlyphIcon focused={focused} glyph="≡" /> }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  icon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  homeDot: { width: 16, height: 16, borderRadius: 5 },
});
