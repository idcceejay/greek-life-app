import { describe, expect, it } from 'vitest';
import {
  nextRsvp,
  realEventId,
  rsvpCountLine,
  RsvpRow,
  summarizeRsvps,
} from '../../lib/rsvpCore';

const rows: RsvpRow[] = [
  { user_id: 'u3', status: 'going', name: 'Zoe' },
  { user_id: 'u1', status: 'going', name: 'Ana' },
  { user_id: 'u2', status: 'maybe', name: 'Ben' },
  { user_id: 'u4', status: 'not_going', name: 'Cy' },
];

describe('rsvpCore', () => {
  it('groups names by answer, alphabetically', () => {
    const s = summarizeRsvps(rows, 'u2');
    expect(s.going).toEqual(['Ana', 'Zoe']);
    expect(s.maybe).toEqual(['Ben']);
    expect(s.notGoing).toEqual(['Cy']);
    expect(s.mine).toBe('maybe');
  });

  it('mine is null when the viewer has not replied', () => {
    expect(summarizeRsvps(rows, 'nobody').mine).toBeNull();
    expect(summarizeRsvps([], undefined).mine).toBeNull();
  });

  it('tapping the current answer clears it', () => {
    expect(nextRsvp('going', 'going')).toBeNull();
    expect(nextRsvp('going', 'maybe')).toBe('maybe');
    expect(nextRsvp(null, 'not_going')).toBe('not_going');
  });

  it('strips the repeat suffix from expanded yearly events', () => {
    expect(realEventId('abc@2027')).toBe('abc');
    expect(realEventId('abc')).toBe('abc');
  });

  it('builds the count line', () => {
    expect(rsvpCountLine(summarizeRsvps(rows, undefined))).toBe("2 going · 1 maybe · 1 can't go");
    expect(rsvpCountLine(summarizeRsvps([], undefined))).toBe('No replies yet');
  });
});
