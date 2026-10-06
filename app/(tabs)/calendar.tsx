import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { Card, Icon, ScreenTitle } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { useSession } from '../../lib/useSession';
import { useMyOrg, useEvents, createEvent, deleteEvent, EventRow } from '../../lib/data';
import { addToPhoneCalendar, usePhoneCalendar } from '../../lib/usePhoneCalendar';
import { groupBySource, PhoneEvent } from '../../lib/phoneCalendarCore';
import { colors, iconSize, radius, spacing, type } from '../../lib/theme';

const MODES = ['Day', 'Week', 'Month'] as const;
type Mode = (typeof MODES)[number];
const REPEATS = [
  { key: null, label: 'Once' },
  { key: 'FREQ=YEARLY', label: 'Every year' },
] as const;

/** One-tap titles so the form never starts blank. */
const TITLE_PICKS = ['Chapter meeting', 'Social', 'Philanthropy', 'Study hours'] as const;

/** Round up to the next full hour — a friendly default start time. */
function nextHour() {
  return dayjs().add(1, 'hour').startOf('hour').toDate();
}

/** Next date after now on the same weekday and clock time as `d`. */
function nextSameSlot(d: dayjs.Dayjs) {
  let c = dayjs().day(d.day()).hour(d.hour()).minute(d.minute()).second(0).millisecond(0);
  if (!c.isAfter(dayjs())) c = c.add(1, 'week');
  return c;
}

export default function CalendarScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { membership, loading: orgLoading } = useMyOrg(userId);
  const { events: liveEvents, loading: eventsLoading, refresh } = useEvents(membership?.org.id);
  const isAdmin = membership?.role === 'admin' || membership?.role === 'treasurer';
  // Until both have answered, "no organization" / "nothing scheduled" would be
  // a guess — show a loading card instead.
  const loading = orgLoading || (!!membership && eventsLoading);
  const params = useLocalSearchParams<{ new?: string }>();
  const [prefilled, setPrefilled] = useState(false);

  const [mode, setMode] = useState<Mode>('Week');
  const [selected, setSelected] = useState(dayjs());
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [when, setWhen] = useState<Date>(nextHour());
  const [repeat, setRepeat] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showCals, setShowCals] = useState(false);
  // Apple / Google / Outlook calendars already on this phone, read on-device.
  const phone = usePhoneCalendar(selected);

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

  const inView = useMemo(() => {
    const start = selected.startOf('week'); // Sunday
    const end = start.add(7, 'day');
    return (iso: string) => {
      const d = dayjs(iso);
      if (mode === 'Day') return d.isSame(selected, 'day');
      if (mode === 'Week') return !d.isBefore(start) && d.isBefore(end);
      return d.isSame(selected, 'month');
    };
  }, [mode, selected]);

  const visible = useMemo(() => events.filter((e) => inView(e.starts_at)), [events, inView]);
  const visiblePhone = useMemo(
    () => phone.events.filter((e) => inView(e.starts_at)),
    [phone.events, inView],
  );
  // Rally and phone events in one time-ordered list.
  const items = useMemo(
    () =>
      [
        ...visible.map((e) => ({ kind: 'rally' as const, e })),
        ...visiblePhone.map((e) => ({ kind: 'phone' as const, e })),
      ].sort((a, b) => a.e.starts_at.localeCompare(b.e.starts_at)),
    [visible, visiblePhone],
  );

  // Weeks run Sunday → Saturday
  const weekStart = selected.startOf('week');
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  const gridStart = selected.startOf('month').startOf('week');
  const monthDays = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  const eventDays = useMemo(
    () => new Set(events.map((e) => dayjs(e.starts_at).format('YYYY-MM-DD'))),
    [events],
  );
  const phoneDays = useMemo(
    () => new Set(phone.events.map((e) => dayjs(e.starts_at).format('YYYY-MM-DD'))),
    [phone.events],
  );
  /** Chapter events get the accent dot; days with only phone events a grey one. */
  const dotColor = (key: string) =>
    eventDays.has(key) ? colors.accent : phoneDays.has(key) ? colors.inkTertiary : undefined;

  // Smart defaults: start from the chapter's most recent past event (its title,
  // place, weekday and time) so the common case — the weekly meeting — is one
  // tap. With no history, fall back to the next full hour and a blank title.
  const openNew = () => {
    const last = liveEvents
      .filter((e) => !e.rrule && dayjs(e.starts_at).isBefore(dayjs()))
      .at(-1);
    const today = selected.isSame(dayjs(), 'day');
    if (last) {
      const d = dayjs(last.starts_at);
      setTitle(last.title);
      setPlace(last.location_text ?? '');
      setWhen(
        today
          ? nextSameSlot(d).toDate()
          : selected.hour(d.hour()).minute(d.minute()).second(0).toDate(),
      );
      setPrefilled(true);
    } else {
      setTitle('');
      setPlace('');
      setWhen(today ? nextHour() : selected.hour(18).minute(0).second(0).toDate());
      setPrefilled(false);
    }
    setRepeat(null);
    setErr(null);
    setShowNew(true);
  };

  // Home's "New event" buttons link here with ?new=1. Wait for events so the
  // defaults above can use them, then clear the flag so it fires once.
  useEffect(() => {
    if (params.new === '1' && membership && !eventsLoading) {
      openNew();
      router.setParams({ new: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.new, membership, eventsLoading]);

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

  // Tap a chapter event to copy it into the phone's calendar (Apple or Google).
  const addToPhone = async (e: EventRow) => {
    if (!(await phone.connect())) return;
    const ok = await addToPhoneCalendar(e);
    if (!ok) Alert.alert("Couldn't open your calendar", 'Please try again.');
  };

  const shift = (n: number) =>
    setSelected(selected.add(n, mode === 'Day' ? 'day' : mode === 'Week' ? 'week' : 'month'));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleRow}>
          <ScreenTitle>Calendar</ScreenTitle>
          <View style={s.titleBtns}>
            {phone.status !== 'unavailable' && (
              <Pressable
                style={s.calsBtn}
                onPress={() => setShowCals(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Your calendars"
                accessibilityHint="Show your Apple or Google calendar events here"
              >
                <Icon name="layers-outline" size={iconSize.m} />
              </Pressable>
            )}
            {membership && (
              <Pressable
                style={s.addBtn}
                onPress={openNew}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityLabel="New event"
              >
                <Text style={s.addBtnText}>+ Event</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={s.segment} accessibilityRole="tablist">
          {MODES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              accessibilityRole="tab"
              accessibilityLabel={`${m} view`}
              accessibilityState={{ selected: mode === m }}
              style={[s.segmentItem, mode === m && s.segmentItemActive]}
            >
              <Text style={[s.segmentText, mode === m && s.segmentTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.periodRow}>
          <Pressable
            onPress={() => shift(-1)}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={`Previous ${mode.toLowerCase()}`}
          >
            <Text style={s.chev} accessibilityElementsHidden>
              ‹
            </Text>
          </Pressable>
          <Text style={type.headline} accessibilityRole="header">
            {mode === 'Day' && selected.format('dddd, MMM D')}
            {mode === 'Week' &&
              `${weekStart.format('MMM D')} – ${weekStart.add(6, 'day').format('MMM D')}`}
            {mode === 'Month' && selected.format('MMMM YYYY')}
          </Text>
          <Pressable
            onPress={() => shift(1)}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={`Next ${mode.toLowerCase()}`}
          >
            <Text style={s.chev} accessibilityElementsHidden>
              ›
            </Text>
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
                {items.length === 0
                  ? 'No events'
                  : `${items.length} event${items.length === 1 ? '' : 's'}`}
              </Text>
            </View>
            {!selected.isSame(dayjs(), 'day') && (
              <Pressable
                style={s.todayBtn}
                onPress={() => setSelected(dayjs())}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Jump to today"
              >
                <Text style={s.todayBtnText}>Today</Text>
              </Pressable>
            )}
          </View>
        )}

        {mode === 'Week' && (
          <View style={s.week}>
            {weekDays.map((d) => {
              const isSelected = d.isSame(selected, 'day');
              const dot = dotColor(d.format('YYYY-MM-DD'));
              const hasEvent = !!dot;
              return (
                <Pressable
                  key={d.format('YYYY-MM-DD')}
                  style={s.day}
                  onPress={() => setSelected(d)}
                  accessibilityRole="button"
                  // The event dot is colour-only, so say it out loud.
                  accessibilityLabel={`${d.format('dddd MMMM D')}${hasEvent ? ', has events' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={type.caption} accessibilityElementsHidden>
                    {d.format('dd')}
                  </Text>
                  <View style={[s.dayNum, isSelected && s.dayNumActive]}>
                    <Text style={[s.dayNumText, isSelected && s.dayNumTextActive]}>{d.date()}</Text>
                  </View>
                  <View style={[s.dot, dot ? { backgroundColor: dot } : null]} />
                </Pressable>
              );
            })}
          </View>
        )}

        {mode === 'Month' && (
          <View style={s.monthGrid}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <Text
                key={i}
                style={[s.monthCell, type.caption, { textAlign: 'center' }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {d}
              </Text>
            ))}
            {monthDays.map((d) => {
              const inMonth = d.isSame(selected, 'month');
              const isSelected = d.isSame(selected, 'day');
              const dot = dotColor(d.format('YYYY-MM-DD'));
              const hasEvent = !!dot;
              return (
                <Pressable
                  key={d.format('YYYY-MM-DD')}
                  style={s.monthCell}
                  onPress={() => setSelected(d)}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.format('dddd MMMM D')}${hasEvent ? ', has events' : ''}${
                    inMonth ? '' : ', outside this month'
                  }`}
                  accessibilityState={{ selected: isSelected }}
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
                  <View style={[s.dot, dot ? { backgroundColor: dot } : null]} />
                </Pressable>
              );
            })}
          </View>
        )}

        {loading && (
          <Card style={s.empty}>
            <View
              accessible
              accessibilityLabel="Loading your chapter's events"
              accessibilityState={{ busy: true }}
              style={{ gap: spacing.s }}
            >
              <View style={[s.skel, { width: '58%', height: 16 }]} />
              <View style={[s.skel, { width: '82%', height: 12 }]} />
              <Text style={type.caption}>Loading your chapter's events</Text>
            </View>
          </Card>
        )}
        {!loading && items.length === 0 && (
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
        {items.map((it) => {
          if (it.kind === 'phone') return <PhoneEventCard key={it.e.id} e={it.e} mode={mode} />;
          const e = it.e;
          return (
          <Pressable
            key={e.id}
            onPress={phone.status !== 'unavailable' ? () => addToPhone(e) : undefined}
            onLongPress={() => confirmDelete(e)}
            delayLongPress={400}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${e.title}, ${dayjs(e.starts_at).format('dddd MMMM D, h:mm A')}${
              e.location_text ? `, at ${e.location_text}` : ''
            }${e.rrule ? ', repeats yearly' : ''}`}
            accessibilityHint={
              phone.status !== 'unavailable' ? "Adds it to your phone's calendar" : undefined
            }
            // Long-press is unreachable under VoiceOver, so expose delete as a
            // rotor action too (SC 2.5.1 / 2.1.1).
            accessibilityActions={
              isAdmin || e.created_by === userId
                ? [{ name: 'delete', label: 'Delete event' }]
                : undefined
            }
            onAccessibilityAction={(ev) => {
              if (ev.nativeEvent.actionName === 'delete') confirmDelete(e);
            }}
          >
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
          );
        })}
        {visible.length > 0 && (
          <Text style={s.hintText}>
            {phone.status !== 'unavailable'
              ? "Tap a chapter event to add it to your phone's calendar. Hold to delete it (creator or admin)."
              : 'Hold an event to delete it (creator or admin).'}
          </Text>
        )}
      </ScrollView>

      {/* New event sheet */}
      <Sheet visible={showNew} onClose={() => setShowNew(false)} label="New event">
        <View style={s.modal}>
          <Text style={[type.title2, { marginBottom: spacing.s }]} accessibilityRole="header">
            New event
          </Text>
          <TextInput
            style={s.input}
            placeholder="Title"
            placeholderTextColor={colors.inkTertiary}
            value={title}
            onChangeText={setTitle}
            accessibilityLabel="Event title"
          />
          <View style={s.titleChips}>
            {TITLE_PICKS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTitle(t)}
                hitSlop={{ top: 6, bottom: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Use title ${t}`}
                accessibilityState={{ selected: title === t }}
                style={[s.repeatChip, s.titleChip, title === t && s.repeatChipOn]}
              >
                <Text style={[s.repeatChipText, title === t && { color: '#fff' }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={s.input}
            placeholder="Location (optional)"
            placeholderTextColor={colors.inkTertiary}
            value={place}
            onChangeText={setPlace}
            accessibilityLabel="Location, optional"
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
                  hitSlop={{ top: 10, bottom: 10 }}
                  accessibilityRole="radio"
                  accessibilityLabel={r.label}
                  accessibilityState={{ checked: repeat === r.key }}
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
          {prefilled && (
            <Text style={type.caption}>
              Filled in from your last event. Change anything you need.
            </Text>
          )}

          {err && (
            <Text style={s.err} accessibilityLiveRegion="assertive" accessibilityRole="alert">
              {err}
            </Text>
          )}
          <View style={s.modalBtns}>
            <Pressable
              style={[s.mBtn, s.mBtnGhost]}
              onPress={() => setShowNew(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[s.mBtnText, { color: colors.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={s.mBtn}
              onPress={submitNew}
              accessibilityRole="button"
              accessibilityLabel="Create event"
            >
              <Text style={s.mBtnText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </Sheet>

      {/* Your calendars: show phone (Apple / Google) calendars alongside chapter events */}
      <Sheet visible={showCals} onClose={() => setShowCals(false)} label="Your calendars">
        <ScrollView style={s.calsScroll} contentContainerStyle={s.modal}>
          <Text style={type.title2} accessibilityRole="header">
            Your calendars
          </Text>
          <Text style={type.subhead}>
            See your Apple and Google Calendar events next to your chapter's. They stay on this
            phone: Rally never uploads them or shows them to anyone else.
          </Text>

          {phone.status !== 'granted' && (
            <>
              {phone.status === 'denied' && (
                <Text style={type.caption}>
                  Calendar access is turned off for Rally. Turn it on in Settings, then come back.
                </Text>
              )}
              <Pressable
                style={s.mBtn}
                onPress={phone.connect}
                accessibilityRole="button"
                accessibilityLabel={phone.status === 'denied' ? 'Open Settings' : 'Connect calendars'}
              >
                <Text style={s.mBtnText}>
                  {phone.status === 'denied' ? 'Open Settings' : 'Connect calendars'}
                </Text>
              </Pressable>
            </>
          )}

          {phone.status === 'granted' && (
            <>
              <View style={[s.calGroup, s.calRow]}>
                <Text style={[type.body, { flex: 1 }]}>Show on Rally calendar</Text>
                <Switch
                  value={phone.show}
                  onValueChange={phone.setShow}
                  trackColor={{ true: colors.accent }}
                  accessibilityLabel="Show phone calendars on Rally calendar"
                />
              </View>
              {phone.show && phone.calendars.length === 0 && (
                <Text style={type.caption}>No calendars found on this phone.</Text>
              )}
              {phone.show &&
                groupBySource(phone.calendars).map((g) => (
                  <View key={g.source} style={s.calGroup}>
                    <Text style={s.calSource} accessibilityRole="header">
                      {g.source}
                    </Text>
                    {g.calendars.map((c) => (
                      <View key={c.id} style={s.calRow}>
                        <View style={[s.calSwatch, { backgroundColor: c.color }]} />
                        <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                          {c.title}
                        </Text>
                        <Switch
                          value={!phone.hidden.includes(c.id)}
                          onValueChange={() => phone.toggleCalendar(c.id)}
                          trackColor={{ true: colors.accent }}
                          accessibilityLabel={`${c.title}, ${g.source}`}
                        />
                      </View>
                    ))}
                  </View>
                ))}
            </>
          )}

          <Text style={type.caption}>
            Use Google Calendar? On your iPhone open Settings → Apps → Calendar → Calendar Accounts
            → Add Account → Google. Its calendars then show up here.
          </Text>

          <Pressable
            style={[s.mBtn, s.mBtnGhost]}
            onPress={() => setShowCals(false)}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={[s.mBtnText, { color: colors.ink }]}>Done</Text>
          </Pressable>
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
}

/** Read-only card for an event from the phone's own calendar. */
function PhoneEventCard({ e, mode }: { e: PhoneEvent; mode: Mode }) {
  const start = dayjs(e.starts_at);
  const when = e.all_day ? 'All day' : start.format('h:mm A');
  return (
    <View
      accessible
      accessibilityLabel={`${e.title}, ${start.format('dddd MMMM D')}, ${when}${
        e.location_text ? `, at ${e.location_text}` : ''
      }, from your ${e.calendarTitle} calendar`}
    >
      <Card style={s.eventCard}>
        <View style={[s.eventAccent, { backgroundColor: e.color }]} />
        {mode === 'Day' && (
          <View style={s.timeCol}>
            <Text style={s.timeBig}>{e.all_day ? 'All' : start.format('h:mm')}</Text>
            <Text style={type.caption}>{e.all_day ? 'day' : start.format('A')}</Text>
          </View>
        )}
        <View style={s.eventBody}>
          <View style={s.eventTopRow}>
            <Text style={[type.caption, { flexShrink: 1 }]} numberOfLines={1}>
              {mode === 'Day' ? e.calendarTitle : `${start.format('ddd')} · ${when}`}
            </Text>
            {mode !== 'Day' && (
              <Text style={[type.caption, s.phoneTag]} numberOfLines={1}>
                {e.calendarTitle}
              </Text>
            )}
          </View>
          <Text style={type.headline}>{e.title}</Text>
          {mode === 'Day' && e.location_text && <Text style={type.caption}>{e.location_text}</Text>}
        </View>
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: spacing.l, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: 6 },
  calsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
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
  skel: { borderRadius: 8, backgroundColor: colors.separator },
  eventCard: { flexDirection: 'row', padding: 0, overflow: 'hidden', marginBottom: spacing.m },
  eventAccent: { width: 4, backgroundColor: colors.accent },
  eventBody: { flex: 1, padding: spacing.l, gap: 4 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  phoneTag: { flexShrink: 1, marginLeft: spacing.s, textAlign: 'right' },
  calsScroll: {
    maxHeight: 640,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  calGroup: { backgroundColor: colors.card, borderRadius: radius.control, paddingHorizontal: spacing.l },
  calSource: { ...type.caption, paddingTop: spacing.m },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, minHeight: 48 },
  calSwatch: { width: 12, height: 12, borderRadius: 6 },
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
  // Title quick-picks sit on the canvas-coloured sheet, so they need the white
  // card fill to read as buttons, and must wrap rather than run off-screen.
  titleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  titleChip: { backgroundColor: colors.card, minHeight: 36, justifyContent: 'center' },
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
