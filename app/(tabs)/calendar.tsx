import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { Card, ScreenTitle } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useSession } from '../../lib/useSession';
import { useMyOrg, useEvents, createEvent, deleteEvent, EventRow } from '../../lib/data';
import { colors, radius, spacing, type } from '../../lib/theme';

const MODES = ['Day', 'Week', 'Month'] as const;
type Mode = (typeof MODES)[number];
const REPEATS = [
  { key: null, label: 'Once' },
  { key: 'FREQ=YEARLY', label: 'Every year' },
] as const;

/** Round up to the next full hour — a friendly default start time. */
function nextHour() {
  return dayjs().add(1, 'hour').startOf('hour').toDate();
}

export default function CalendarScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { membership } = useMyOrg(userId);
  const { events: liveEvents, refresh } = useEvents(membership?.org.id);
  const isAdmin = membership?.role === 'admin' || membership?.role === 'treasurer';

  const [mode, setMode] = useState<Mode>('Week');
  const [selected, setSelected] = useState(dayjs());
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [when, setWhen] = useState<Date>(nextHour());
  const [repeat, setRepeat] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const baseEvents: EventRow[] = liveEvents;

  // Expand yearly-repeating events into this year ± 1 (birthdays, anniversaries).
  const events = useMemo(() => {
    const out = baseEvents.filter((e) => !e.rrule);
    const years = [selected.year() - 1, selected.year(), selected.year() + 1];
    for (const e of baseEvents.filter((ev) => ev.rrule?.includes('YEARLY'))) {
      const base = dayjs(e.starts_at);
      for (const y of years) {
        out.push({ ...e, id: `${e.id}@${y}`, starts_at: base.year(y).toISOString() });
      }
    }
    return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [baseEvents, selected.year()]);

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

  const openNew = () => {
    setTitle('');
    setPlace('');
    setWhen(
      selected.isSame(dayjs(), 'day')
        ? nextHour()
        : selected.hour(18).minute(0).second(0).toDate(),
    );
    setRepeat(null);
    setErr(null);
    setShowNew(true);
  };

  const submitNew = async () => {
    setErr(null);
    if (!membership || !userId) return;
    if (title.trim().length < 2) return setErr('Give the event a title.');
    const res = await createEvent(membership.org.id, userId, {
      title: title.trim(),
      location_text: place.trim(),
      starts_at: when,
      rrule: repeat,
    });
    if (!res.ok) return setErr(res.error);
    setShowNew(false);
    setSelected(dayjs(when));
    refresh();
  };

  const confirmDelete = (e: EventRow) => {
    const canDelete = isAdmin || e.created_by === userId;
    if (!canDelete) return;
    const realId = e.id.split('@')[0];
    const isRepeating = !!e.rrule;
    Alert.alert(
      'Delete event',
      isRepeating ? `Delete "${e.title}" and all its repeats?` : `Delete "${e.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEvent(realId);
            refresh();
          },
        },
      ],
    );
  };

  const shift = (n: number) =>
    setSelected(selected.add(n, mode === 'Day' ? 'day' : mode === 'Week' ? 'week' : 'month'));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <ScreenTitle>Calendar</ScreenTitle>
          {membership && (
            <Pressable style={s.addBtn} onPress={openNew}>
              <Text style={s.addBtnText}>+ Event</Text>
            </Pressable>
          )}
        </View>

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

        <View style={s.periodRow}>
          <Pressable onPress={() => shift(-1)} hitSlop={10}>
            <Text style={s.chev}>‹</Text>
          </Pressable>
          <Text style={type.headline}>
            {mode === 'Day' && selected.format('dddd, MMM D')}
            {mode === 'Week' &&
              `${weekStart.format('MMM D')} – ${weekStart.add(6, 'day').format('MMM D')}`}
            {mode === 'Month' && selected.format('MMMM YYYY')}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={10}>
            <Text style={s.chev}>›</Text>
          </Pressable>
        </View>

        {/* Day mode: a single-day agenda, no week strip */}
        {mode === 'Day' && (
          <View style={s.dayHeader}>
            <Text style={s.dayHeaderNum}>{selected.format('D')}</Text>
            <View>
              <Text style={type.headline}>{selected.format('dddd')}</Text>
              <Text style={type.subhead}>{selected.format('MMMM YYYY')}</Text>
              <Text style={type.caption}>
                {visible.length === 0
                  ? 'No events'
                  : `${visible.length} event${visible.length === 1 ? '' : 's'}`}
              </Text>
            </View>
            {!selected.isSame(dayjs(), 'day') && (
              <Pressable style={s.todayBtn} onPress={() => setSelected(dayjs())}>
                <Text style={s.todayBtnText}>Today</Text>
              </Pressable>
            )}
          </View>
        )}

        {mode === 'Week' && (
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

        {visible.length === 0 && (
          <Card style={s.empty}>
            <Text style={type.headline}>
              {membership ? 'Nothing scheduled' : 'No organization yet'}
            </Text>
            <Text style={type.subhead}>
              {membership
                ? `No events in this ${mode.toLowerCase()}.`
                : 'Join or create your chapter on the Home tab to start a calendar.'}
            </Text>
          </Card>
        )}
        {visible.map((e) => (
          <Pressable key={e.id} onLongPress={() => confirmDelete(e)} delayLongPress={400}>
            <Card style={s.eventCard}>
              <View style={s.eventAccent} />
              {mode === 'Day' && (
                <View style={s.timeCol}>
                  <Text style={s.timeBig}>{dayjs(e.starts_at).format('h:mm')}</Text>
                  <Text style={type.caption}>{dayjs(e.starts_at).format('A')}</Text>
                </View>
              )}
              <View style={s.eventBody}>
                <View style={s.eventTopRow}>
                  <Text style={type.caption}>
                    {mode === 'Day'
                      ? (e.location_text ?? 'No location')
                      : dayjs(e.starts_at).format('ddd · h:mm A')}
                    {e.rrule ? '  ·  ↻ yearly' : ''}
                  </Text>
                  {mode !== 'Day' && <Text style={type.caption}>{e.location_text ?? ''}</Text>}
                </View>
                <Text style={type.headline}>{e.title}</Text>
              </View>
            </Card>
          </Pressable>
        ))}
        {visible.length > 0 && (
          <Text style={s.hintText}>Hold an event to delete it (creator or admin).</Text>
        )}
      </ScrollView>

      {/* New event sheet */}
      <Sheet visible={showNew} onClose={() => setShowNew(false)}>
        <View style={s.modal}>
          <Text style={[type.title2, { marginBottom: spacing.s }]}>New event</Text>
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

          <View style={s.pickerRow}>
            <Text style={s.pickerLabel}>Date</Text>
            <DateTimePicker
              value={when}
              mode="date"
              display="compact"
              accentColor={colors.accent}
              onChange={(_, d) => d && setWhen(d)}
            />
          </View>
          <View style={s.pickerRow}>
            <Text style={s.pickerLabel}>Time</Text>
            <DateTimePicker
              value={when}
              mode="time"
              display="compact"
              accentColor={colors.accent}
              onChange={(_, d) => d && setWhen(d)}
            />
          </View>

          <View style={s.pickerRow}>
            <Text style={s.pickerLabel}>Repeat</Text>
            <View style={s.repeatChips}>
              {REPEATS.map((r) => (
                <Pressable
                  key={r.label}
                  onPress={() => setRepeat(r.key)}
                  style={[s.repeatChip, repeat === r.key && s.repeatChipOn]}
                >
                  <Text style={[s.repeatChipText, repeat === r.key && { color: '#fff' }]}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {repeat && (
            <Text style={type.caption}>
              Repeats every {dayjs(when).format('MMMM D')} — great for birthdays.
            </Text>
          )}

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
      </Sheet>
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
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    marginBottom: spacing.l,
    paddingHorizontal: spacing.s,
  },
  dayHeaderNum: { fontSize: 52, fontWeight: '700', color: colors.accent, lineHeight: 56 },
  todayBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  todayBtnText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  timeCol: {
    paddingLeft: spacing.l,
    paddingVertical: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 74,
  },
  timeBig: { fontSize: 20, fontWeight: '700', color: colors.ink },
  empty: { gap: 4, marginBottom: spacing.m },
  eventCard: { flexDirection: 'row', padding: 0, overflow: 'hidden', marginBottom: spacing.m },
  eventAccent: { width: 4, backgroundColor: colors.accent },
  eventBody: { flex: 1, padding: spacing.l, gap: 4 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hintText: { ...type.caption, textAlign: 'center', marginTop: spacing.s },
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
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.control,
    paddingHorizontal: spacing.l,
    paddingVertical: 8,
    minHeight: 48,
  },
  pickerLabel: { fontSize: 16, color: colors.ink, fontWeight: '500' },
  repeatChips: { flexDirection: 'row', gap: spacing.s },
  repeatChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.canvas,
  },
  repeatChipOn: { backgroundColor: colors.accent },
  repeatChipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
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
