/**
 * Pure helpers for showing the phone's own calendars (Apple, Google, Outlook…)
 * inside Rally's Calendar tab. No React Native imports here, so it runs under
 * the Node test runner; the hook that talks to the device is
 * `lib/usePhoneCalendar.ts`.
 *
 * Privacy rule: phone events are read on the device and only ever rendered.
 * They are never written to Supabase or shown to anyone else in the chapter.
 */
import dayjs from 'dayjs';

/** One calendar on the phone, trimmed to what the UI needs. */
export type PhoneCalendar = {
  id: string;
  title: string;
  color: string;
  /** Account it lives in: "iCloud", "you@gmail.com", "Subscribed Calendars"… */
  sourceName: string;
};

/** A phone event, shaped like Rally's EventRow where the screen reads it. */
export type PhoneEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location_text: string | null;
  calendarId: string;
  calendarTitle: string;
  color: string;
};

/** The minimum of expo-calendar's Calendar/Event types we rely on. */
type RawCalendar = {
  id: string;
  title: string;
  color?: string | null;
  source?: { name?: string | null } | null;
};
type RawEvent = {
  id: string;
  calendarId: string;
  title?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  allDay?: boolean;
  location?: string | null;
};

const FALLBACK_COLOR = '#8E8E93';

export function toPhoneCalendar(c: RawCalendar): PhoneCalendar {
  return {
    id: c.id,
    title: c.title || 'Untitled calendar',
    color: c.color || FALLBACK_COLOR,
    sourceName: c.source?.name || 'Other',
  };
}

export function toPhoneEvent(e: RawEvent, cal: PhoneCalendar | undefined): PhoneEvent {
  return {
    // The same recurring event comes back once per occurrence with one id,
    // so the start time keeps React keys unique.
    id: `phone:${e.id}@${dayjs(e.startDate).valueOf()}`,
    title: e.title?.trim() || 'Busy',
    starts_at: dayjs(e.startDate).toISOString(),
    ends_at: dayjs(e.endDate).toISOString(),
    all_day: !!e.allDay,
    location_text: e.location?.trim() || null,
    calendarId: e.calendarId,
    calendarTitle: cal?.title ?? 'Calendar',
    color: cal?.color ?? FALLBACK_COLOR,
  };
}

/**
 * Date window to load for the month around `selected`: the full six-week
 * month grid, which also covers any Sun–Sat week that touches the month.
 */
export function loadWindow(selected: dayjs.Dayjs) {
  const start = selected.startOf('month').startOf('week');
  return { start: start.toDate(), end: start.add(42, 'day').toDate() };
}

/** Group calendars by account, accounts and calendars in A–Z order. */
export function groupBySource(cals: PhoneCalendar[]) {
  const map = new Map<string, PhoneCalendar[]>();
  for (const c of cals) map.set(c.sourceName, [...(map.get(c.sourceName) ?? []), c]);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source, list]) => ({
      source,
      calendars: list.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}
