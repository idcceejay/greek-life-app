import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { Card, ScreenTitle } from '../../components/ui';
import { events } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

const MODES = ['Day', 'Week', 'Month'] as const;

/** Calendar — segmented Day/Week/Month + week strip + event cards (PDF page 4). */
export default function CalendarScreen() {
  const [mode, setMode] = useState<(typeof MODES)[number]>('Week');
  const [selected, setSelected] = useState(dayjs());
  const weekStart = selected.startOf('week').add(1, 'day'); // Monday
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ScreenTitle>Calendar</ScreenTitle>

        {/* Segmented control */}
        <View style={s.segment}>
          {MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[s.segmentItem, mode === m && s.segmentItemActive]}
            >
              <Text style={[s.segmentText, mode === m && s.segmentTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        {/* Week strip */}
        <View style={s.week}>
          {days.map((d) => {
            const isSelected = d.isSame(selected, 'day');
            return (
              <Pressable key={d.format('YYYY-MM-DD')} style={s.day} onPress={() => setSelected(d)}>
                <Text style={type.caption}>{d.format('dd').charAt(0)}</Text>
                <View style={[s.dayNum, isSelected && s.dayNumActive]}>
                  <Text style={[s.dayNumText, isSelected && s.dayNumTextActive]}>
                    {d.date()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Events */}
        {events.map((e) => (
          <Card key={e.id} style={s.eventCard}>
            <View style={s.eventAccent} />
            <View style={s.eventBody}>
              <View style={s.eventTopRow}>
                <Text style={type.caption}>{e.time}</Text>
                <Text style={type.caption}>{e.place}</Text>
              </View>
              <Text style={type.headline}>{e.title}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.l, paddingBottom: spacing.xxl },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E4E3E9',
    borderRadius: radius.control,
    padding: 3,
    marginBottom: spacing.l,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.control - 3,
  },
  segmentItemActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 15, color: colors.inkSecondary, fontWeight: '500' },
  segmentTextActive: { color: colors.ink, fontWeight: '600' },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.s,
  },
  day: { alignItems: 'center', gap: 8 },
  dayNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumActive: { backgroundColor: colors.accent },
  dayNumText: { fontSize: 16, color: colors.ink, fontWeight: '500' },
  dayNumTextActive: { color: '#fff', fontWeight: '700' },
  eventCard: {
    flexDirection: 'row',
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.m,
  },
  eventAccent: { width: 4, backgroundColor: colors.accent },
  eventBody: { flex: 1, padding: spacing.l, gap: 4 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
