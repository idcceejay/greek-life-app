import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ActionChip, Avatar, Card, Pill } from '../../components/ui';
import { chats, nextEvent, org } from '../../lib/mock';
import { colors, spacing, type } from '../../lib/theme';

/** Home — bento grid per the UI Layout PDF (page 3). */
export default function HomeScreen() {
  const router = useRouter();
  const unread = chats.reduce((n, c) => n + c.unread, 0);
  const topChat = chats[0];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <View>
            <Text style={type.caption}>{org.kind}</Text>
            <Text style={type.largeTitle}>{org.name}</Text>
          </View>
          <Avatar initials="CR" size={40} />
        </View>

        {/* Hero: next event */}
        <Card style={s.block} onPress={() => router.push('/(tabs)/calendar')}>
          <Text style={type.eyebrow}>Next event · {nextEvent.when}</Text>
          <Text style={[type.title2, s.heroTitle]}>{nextEvent.title}</Text>
          <Pill label={`RSVP · ${nextEvent.rsvpGoing} going`} />
        </Card>

        {/* Bento pair: Live Map + Dues */}
        <View style={s.row}>
          <Card style={[s.block, s.half]} onPress={() => router.push('/(tabs)/map')}>
            <View style={s.tileGlyph} />
            <Text style={type.headline}>Live Map</Text>
            <Text style={type.subhead}>{org.membersNearby} members nearby</Text>
          </Card>
          <Card style={[s.block, s.half]}>
            <View style={s.tileGlyph} />
            <Text style={type.headline}>Dues</Text>
            <Text style={[type.subhead, { color: colors.warning, fontWeight: '600' }]}>
              ${(org.duesDueCents / 100).toFixed(0)} due
            </Text>
          </Card>
        </View>

        {/* Chats */}
        <Card style={s.block} onPress={() => router.push('/(tabs)/chats')}>
          <View style={s.cardHeaderRow}>
            <View style={s.inlineTitle}>
              <View style={s.tileGlyphSmall} />
              <Text style={type.headline}>Chats</Text>
            </View>
            {unread > 0 && <Pill label={`${unread} unread`} />}
          </View>
          <Text style={type.subhead} numberOfLines={1}>
            {topChat.name}: {topChat.lastMessage}
          </Text>
        </Card>

        {/* Campus feed */}
        <Card style={s.block} onPress={() => router.push('/(tabs)/feed')}>
          <View style={s.cardHeaderRow}>
            <View style={s.inlineTitle}>
              <View style={s.tileGlyphSmall} />
              <Text style={type.headline}>Campus Feed</Text>
            </View>
            <Pill label="live" />
          </View>
          <Text style={type.subhead}>Top post · 142 upvotes · anonymous</Text>
        </Card>

        {/* Quick actions */}
        <View style={s.actionsRow}>
          <ActionChip label="New event" onPress={() => router.push('/(tabs)/calendar')} />
          <ActionChip label="Post" onPress={() => router.push('/(tabs)/feed')} />
          <ActionChip label="Poll" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.l, paddingBottom: spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.l,
  },
  block: { marginBottom: spacing.m },
  heroTitle: { marginTop: 4, marginBottom: spacing.m, fontSize: 26 },
  row: { flexDirection: 'row', gap: spacing.m },
  half: { flex: 1 },
  tileGlyph: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.m,
  },
  tileGlyphSmall: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.accentSoft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  inlineTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  actionsRow: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.s },
});
