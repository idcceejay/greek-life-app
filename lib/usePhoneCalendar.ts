/**
 * Reads the calendars already on this phone (iCloud, plus any Google /
 * Outlook / Exchange account added in iPhone Settings → Apps → Calendar →
 * Calendar Accounts) so the Calendar tab can show them next to chapter events.
 *
 * Nothing here leaves the device: events are read on demand and only kept in
 * memory, and the on/off choices live in AsyncStorage on this phone.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import dayjs from 'dayjs';
import {
  loadWindow,
  PhoneCalendar,
  PhoneEvent,
  toPhoneCalendar,
  toPhoneEvent,
} from './phoneCalendarCore';

export type PhoneCalStatus = 'loading' | 'unavailable' | 'undetermined' | 'denied' | 'granted';

/** `hidden` (not `shown`) so a calendar added later appears by default. */
type Prefs = { show: boolean; hidden: string[] };
const PREFS_KEY = 'rally.phoneCalendars.v1';
const DEFAULT_PREFS: Prefs = { show: true, hidden: [] };

export function usePhoneCalendar(selected: dayjs.Dayjs) {
  const [status, setStatus] = useState<PhoneCalStatus>('loading');
  const [calendars, setCalendars] = useState<PhoneCalendar[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [events, setEvents] = useState<PhoneEvent[]>([]);
  // Bumped when the app comes back to the foreground, so events added in the
  // Calendar app (or a newly added Google account) show up without a restart.
  const [reloadKey, setReloadKey] = useState(0);
  const monthKey = selected.format('YYYY-MM');

  const checkPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'web' || !(await Calendar.isAvailableAsync())) {
        return setStatus('unavailable');
      }
      const p = await Calendar.getCalendarPermissionsAsync();
      setStatus(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => raw && setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) }))
      .catch(() => {});
    checkPermission();
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      checkPermission();
      setReloadKey((k) => k + 1);
    });
    return () => sub.remove();
  }, [checkPermission]);

  useEffect(() => {
    if (status !== 'granted') return setCalendars([]);
    let cancelled = false;
    Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
      .then((cals) => !cancelled && setCalendars(cals.map(toPhoneCalendar)))
      .catch(() => !cancelled && setCalendars([]));
    return () => {
      cancelled = true;
    };
  }, [status, reloadKey]);

  useEffect(() => {
    const ids = calendars.filter((c) => !prefs.hidden.includes(c.id)).map((c) => c.id);
    if (status !== 'granted' || !prefs.show || ids.length === 0) return setEvents([]);
    let cancelled = false;
    const { start, end } = loadWindow(selected);
    const byId = new Map(calendars.map((c) => [c.id, c]));
    Calendar.getEventsAsync(ids, start, end)
      .then((raw) => {
        if (cancelled) return;
        setEvents(raw.map((e) => toPhoneEvent(e, byId.get(e.calendarId))));
      })
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
    // `selected` is covered by monthKey: the window only changes per month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, calendars, prefs, monthKey, reloadKey]);

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  };

  /** Ask iOS for calendar access (or send the user to Settings if they said no before). */
  const connect = async (): Promise<boolean> => {
    if (status === 'granted') return true;
    if (status === 'denied') {
      Linking.openSettings();
      return false;
    }
    try {
      const p = await Calendar.requestCalendarPermissionsAsync();
      setStatus(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied');
      if (p.granted && !prefs.show) savePrefs({ ...prefs, show: true });
      return p.granted;
    } catch {
      setStatus('unavailable');
      return false;
    }
  };

  const setShow = (show: boolean) => savePrefs({ ...prefs, show });

  const toggleCalendar = (id: string) =>
    savePrefs({
      ...prefs,
      hidden: prefs.hidden.includes(id)
        ? prefs.hidden.filter((h) => h !== id)
        : [...prefs.hidden, id],
    });

  return {
    status,
    calendars,
    events,
    show: prefs.show,
    hidden: prefs.hidden,
    connect,
    setShow,
    toggleCalendar,
  };
}

/**
 * Open iOS's own "New Event" screen pre-filled with a Rally event, so a member
 * can copy it into whichever phone calendar they like (Apple or Google). The
 * system screen does the saving and lets them pick the calendar. expo-calendar
 * still checks calendar permission first, so call `connect()` before this.
 */
export async function addToPhoneCalendar(e: {
  title: string;
  starts_at: string;
  location_text: string | null;
}) {
  const start = dayjs(e.starts_at);
  try {
    await Calendar.createEventInCalendarAsync({
      title: e.title,
      startDate: start.toDate(),
      endDate: start.add(1, 'hour').toDate(),
      location: e.location_text ?? undefined,
    });
    return true;
  } catch {
    return false;
  }
}
