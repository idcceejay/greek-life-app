import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Card, ScreenTitle } from '../../components/ui';
import { useSession } from '../../lib/useSession';
import { useMyOrg, useEvents, createEvent, deleteEvent, EventRow } from '../../lib/data';
import { events as mockEvents } from '../../lib/mock';
import { colors, radius, spacing, type } from '../../lib/theme';

dayjs.extend(customParseFormat);

const MODES = ['Day', 'Week', 'Month'] as const;
type Mode = (typeof MODES)[number];

export default function CalendarScreen() {
  const { demoMode, session, profile } = useSession();
  const userId = session?.user.id;
  const { membership } = useMyOrg(userId);
  const { events: liveEvents, refresh } = useEvents(membership?.org.id);
  const isAdmin = membership?.role === 'admin' || membership?.role === 'treasurer';

  const [mode, setMode] = useState<Mode>('Week');
  const [selected, setSelected] = useState(dayjs());
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [when, setWhen] = useState(''); // MM/DD/YYYY HH:mm
  const [err, setErr] = useState<string | null>(null);

  // Demo mode renders the sample events; live mode renders real rows.
  const events: EventRow[] = demoMode
    ? mockEvents.map((e, i) => ({
        id: e.id,
        org_id: 'demo',
        title: e.title,
        location_text: e.place,
        starts_at: dayjs().hour(12 + i).minute(0).toISOString(),
        ends_at: null,
        all_day: false,
        created_by: null,
      }))
    : liveEvents;

  const visible = useMemo(() => {
    if (mode === 'Day') return events.filter((e) => dayjs(e.starts_at).isSame(selected, 'day'));
    if (mode === 'Week') {
      const start = selected.startOf('week'); // Sunday
      const end = start.add(7, 'day');
      return events.filter(
        (e) => dayjs(e.starts_at).isAfter(start.subtract(1, 'ms')) && dayjs(e.starts_at).isBefore(end),
      );
    }
    return events.filter((e) => dayjs(e.starts_at).isSame(selected, 'month'));
  }, [events, mode, selected]);

  // Weeks run Sunday → Saturday
  const weekStart = selected.startOf('week');
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  const gridStart = selected.startOf('month').startOf('week');
  const monthDays = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  const eventDays = useMemo(
    () => new Set(events.map((e) => dayjs(e.starts_at).format('YYYY-MM-DD'))),
    [events],
  );

  const submitNew = async () => {
    setErr(null);
    if (!membership || !userId) return;
    if (title.trim().length < 2) return setErr('Give the event a title.');
    const dt = dayjs(when.trim(), ['MM/DD/YYYY HH:mm', 'M/D/YYYY HH:mm', 'M/D/YYYY H:mm'], true);
    if (!dt.isValid()) return setErr('Date must be MM/DD/YYYY HH:mm (e.g. 08/15/2026 19:30)');
    const res = await createEvent(membership.org.id, userId, {
      title: title.trim(),
      location_text: place.trim(),
      starts_at: dt.toDate(),
    });
    if (!res.ok) return setErr(res.error);
    setShowNew(false);
    setTitle('');
    setPlace('');
    setWhen('');
    setSelected(dt);
    refresh();
  };

  const confirmDelete = (e: EventRow) => {
    if (demoMode) return;
    const canDelete = isAdmin || e.created_by === userId;
    if (!canDelete) return;
    Alert.alert('Delete event', `Delete "${e.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(e.id);
          refresh();
        },
      },
    ]);
  };

  const shift = (n: number) =>
    setSelected(selected.add(n, mode === 'Day' ? 'day' : mode === 'Week' ? 'week' : 'month'));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <ScreenTitle>Calendar</ScreenTitle>
          {!demoMode && membership && (
            <Pressable style={s.addBtn} onPress={() => setShowNew(true)}>
              <Text style={s.addBtnText}>+ Event</Text>
            </Pressable>
          )}
        </View>

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

        {/* Period header with prev/next */}
        <View style={s.periodRow}>
          <Pressable onPress={() => shift(-1)} hitSlop={10}>
            <Text style={s.chev}>‹</Text>
          </Pressable>
          <Text style={type.headline}>
            {mode === 'Day' && selected.format('dddd, MMM D')}
            {mode === 'Week' && `${weekStart.format('MMM D')} – ${weekStart.add(6, 'day').format('MMM D')}`}
            {mode === 'Month' && selected.format('MMMM YYYY')}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={10}>
            <Text style={s.chev}>›</Text>
          </Pressable>
        </View>

        {/* Week strip (Day + Week modes) */}
        {mode !== 'Month' && (
          <View style={s.week}>
            {weekDays.map((d) => {
              const isSelected = d.isSame(selected, 'day');
              const hasEvent = eventDays.has(d.format('YYYY-MM-DD'));
              return (
                <Pressable key={d.format('YYYY-MM-DD')} style={s.day} onPress={() => setSelected(d)}>
                  <Text style={type.caption}>{d.format('dd')}</Text>
                  <View style={[s.dayNum, isSelected && s.dayNumActive]}>
                    <Text style={[s.dayNumText, isSelected && s.dayNumTextActive]}>{d.date()}</Text>
                  </View>
                  <View style={[s.dot, hasEvent && { backgroundColor: colors.accent }]} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Month grid */}
        {mode === 'Month' && (
          <View style={s.monthGrid}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <Text key={i} style={[s.monthCell, type.caption, { textAlign: 'center' }]}>
                {d}
              </Text>
            ))}
            {monthDays.map((d) => {
              const inMonth = d.isSame(selected, 'month');
              const isSelected = d.isSame(selected, 'day');
              const hasEvent = eventDays.has(d.format('YYYY-MM-DD'));
              return (
                <Pressable
                  key={d.format('YYYY-MM-DD')}
                  style={s.monthCell}
                  onPress={() => setSelected(d)}
                >
                  <View style={[s.monthDay, isSelected && s.dayNumActive]}>
                    <Text
                      style={[
                        s.dayNumText,
                        !inMonth && { color: colors.inkTertiary },
                        isSelected && s.dayNumTextActive,
                      ]}
                    >
                      {d.date()}
                    </Text>
                  </View>
                  <View style={[s.dot, hasEvent && { backgroundColor: colors.accent }]} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Events list */}
        {visible.length === 0 && (
          <Card style={s.empty}>
            <Text style={type.headline}>
              {membership || demoMode ? 'Nothing scheduled' : 'No organization yet'}
            </Text>
            <Text style={type.subhead}>
              {membership || demoMode
                ? `No events in this ${mode.toLowerCase()}.`
                : 'Join or create your chapter on the Home tab to start a calendar.'}
            </Text>
          </Card>
        )}
        {visible.map((e) => (
          <Pressable key={e.id} onLongPress={() => confirmDelete(e)} delayLongPress={400}>
            <Card style={s.eventCard}>
              <View style={s.eventAccent} />
              <View style={s.eventBody}>
                <View style={s.eventTopRow}>
                  <Text style={type.caption}>{dayjs(e.starts_at).format('ddd · h:mm A')}</Text>
                  <Text style={type.caption}>{e.location_text ?? ''}</Text>
                </View>
                <Text style={type.headline}>{e.title}</Text>
              </View>
            </Card>
          </Pressable>
        ))}
        {!demoMode && visible.length > 0 && (
          <Text style={s.hintText}>Hold an event to delete it (creator or admin).</Text>
        )}
      </ScrollView>

      {/* New event modal */}
      <Modal visible={showNew} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={s.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modal}>
            <Text style={[type.title2, { marginBottom: spacing.m }]}>New event</Text>
            <TextInput
              style={s.input}
              placeholder="Title"
              placeholderTextColor={colors.inkTertiary}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={s.input}
              placeholder="Location (optional)"
              placeholderTextColor={colors.inkTertiary}
              value={place}
              onChangeText={setPlace}
            />
            <TextInput
              style={s.input}
              placeholder="MM/DD/YYYY HH:mm  (e.g. 08/15/2026 19:30)"
              placeholderTextColor={colors.inkTertiary}
              value={when}
              onChangeText={setWhen}
            />
            {err && <Text style={s.err}>{err}</Text>}
            <View style={s.modalBtns}>
              <Pressable style={[s.mBtn, s.mBtnGhost]} onPress={() => setShowNew(false)}>
                <Text style={[s.mBtnText, { color: colors.ink }]}>Cancel</Text>
              </Pressable>
              <Pressable style={s.mBtn} onPress={submitNew}>
                <Text style={s.mBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.l, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E4E3E9',
    borderRadius: radius.control,
    padding: 3,
    marginBottom: spacing.m,
  },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.control - 3 },
  segmentItemActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 15, color: colors.inkSecondary, fontWeight: '500' },
  segmentTextActive: { color: colors.ink, fontWeight: '600' },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
    paddingHorizontal: spacing.s,
  },
  chev: { fontSize: 28, color: colors.accent, fontWeight: '600', paddingHorizontal: spacing.m },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.l,
    paddingHorizontal: spacing.s,
  },
  day: { alignItems: 'center', gap: 6 },
  dayNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNumActive: { backgroundColor: colors.accent },
  dayNumText: { fontSize: 16, color: colors.ink, fontWeight: '500' },
  dayNumTextActive: { color: '#fff', fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.l },
  monthCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  monthDay: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { gap: 4, marginBottom: spacing.m },
  eventCard: { flexDirection: 'row', padding: 0, overflow: 'hidden', marginBottom: spacing.m },
  eventAccent: { width: 4, backgroundColor: colors.accent },
  eventBody: { flex: 1, padding: spacing.l, gap: 4 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hintText: { ...type.caption, textAlign: 'center', marginTop: spacing.s },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.m,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
  },
  err: { color: colors.danger, fontSize: 14 },
  modalBtns: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.s },
  mBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mBtnGhost: { backgroundColor: colors.card },
  mBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
