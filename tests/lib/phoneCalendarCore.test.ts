import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import {
  groupBySource,
  loadWindow,
  toPhoneCalendar,
  toPhoneEvent,
} from '../../lib/phoneCalendarCore';

describe('loadWindow', () => {
  it('covers the whole six-week month grid, Sunday to Saturday', () => {
    // Oct 2026 starts on a Thursday, so the grid starts Sun Sep 27.
    const { start, end } = loadWindow(dayjs('2026-10-15T12:00:00'));
    expect(dayjs(start).format('YYYY-MM-DD ddd')).toBe('2026-09-27 Sun');
    expect(dayjs(end).diff(start, 'day')).toBe(42);
  });

  it('includes a week that runs past the end of the month', () => {
    const sel = dayjs('2026-10-31T12:00:00');
    const { end } = loadWindow(sel);
    expect(dayjs(end).isAfter(sel.endOf('week'))).toBe(true);
  });
});

describe('toPhoneCalendar', () => {
  it('fills in missing title, colour and account', () => {
    expect(toPhoneCalendar({ id: 'c1', title: '', color: null, source: null })).toEqual({
      id: 'c1',
      title: 'Untitled calendar',
      color: '#8E8E93',
      sourceName: 'Other',
    });
  });
});

describe('toPhoneEvent', () => {
  const cal = toPhoneCalendar({ id: 'c1', title: 'Work', color: '#1A73E8', source: { name: 'Google' } });

  it('maps to the shape the calendar screen reads', () => {
    const e = toPhoneEvent(
      {
        id: 'e1',
        calendarId: 'c1',
        title: '  Standup ',
        startDate: '2026-10-06T14:00:00.000Z',
        endDate: '2026-10-06T14:15:00.000Z',
        allDay: false,
        location: '',
      },
      cal,
    );
    expect(e).toMatchObject({
      title: 'Standup',
      starts_at: '2026-10-06T14:00:00.000Z',
      all_day: false,
      location_text: null,
      calendarTitle: 'Work',
      color: '#1A73E8',
    });
  });

  it('gives each occurrence of a repeating event its own id', () => {
    const base = { id: 'e1', calendarId: 'c1', title: 'Gym', allDay: false };
    const a = toPhoneEvent({ ...base, startDate: '2026-10-05T10:00:00Z', endDate: '2026-10-05T11:00:00Z' }, cal);
    const b = toPhoneEvent({ ...base, startDate: '2026-10-12T10:00:00Z', endDate: '2026-10-12T11:00:00Z' }, cal);
    expect(a.id).not.toBe(b.id);
  });

  it('shows "Busy" for an untitled event', () => {
    const e = toPhoneEvent(
      { id: 'e2', calendarId: 'c1', title: null, startDate: '2026-10-06', endDate: '2026-10-07', allDay: true },
      cal,
    );
    expect(e.title).toBe('Busy');
    expect(e.all_day).toBe(true);
  });
});

describe('groupBySource', () => {
  it('groups by account, both levels A–Z', () => {
    const cals = [
      toPhoneCalendar({ id: '1', title: 'Work', source: { name: 'you@gmail.com' } }),
      toPhoneCalendar({ id: '2', title: 'Home', source: { name: 'iCloud' } }),
      toPhoneCalendar({ id: '3', title: 'Classes', source: { name: 'you@gmail.com' } }),
    ];
    const g = groupBySource(cals);
    expect(g.map((x) => x.source)).toEqual(['iCloud', 'you@gmail.com']);
    expect(g[1].calendars.map((c) => c.title)).toEqual(['Classes', 'Work']);
  });
});
