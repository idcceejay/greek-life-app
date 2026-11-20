/**
 * Pure RSVP helpers (no Supabase import) so they're unit-tested in
 * tests/lib/rsvp.test.ts. Data access lives in lib/data.ts.
 */
export type RsvpStatus = 'going' | 'maybe' | 'not_going';

export type RsvpRow = { user_id: string; status: RsvpStatus; name: string };

export const RSVP_OPTIONS: { key: RsvpStatus; label: string }[] = [
  { key: 'going', label: 'Going' },
  { key: 'maybe', label: 'Maybe' },
  { key: 'not_going', label: "Can't go" },
];

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  going: 'Going',
  maybe: 'Maybe',
  not_going: "Can't go",
};

/**
 * Yearly repeats are expanded client-side with ids like "<uuid>@2027"; the
 * database only knows the base event id.
 */
export function realEventId(id: string): string {
  return id.split('@')[0];
}

export type RsvpSummary = {
  going: string[];
  maybe: string[];
  notGoing: string[];
  mine: RsvpStatus | null;
};

/** Group names by answer (alphabetical) and pick out the viewer's own answer. */
export function summarizeRsvps(rows: RsvpRow[], myId: string | undefined): RsvpSummary {
  const by = (s: RsvpStatus) =>
    rows
      .filter((r) => r.status === s)
      .map((r) => r.name)
      .sort((a, b) => a.localeCompare(b));
  return {
    going: by('going'),
    maybe: by('maybe'),
    notGoing: by('not_going'),
    mine: rows.find((r) => r.user_id === myId)?.status ?? null,
  };
}

/** Tapping your current answer again clears it; anything else sets it. */
export function nextRsvp(current: RsvpStatus | null, tapped: RsvpStatus): RsvpStatus | null {
  return current === tapped ? null : tapped;
}

/** "3 going · 1 maybe", or "No replies yet". */
export function rsvpCountLine(s: RsvpSummary): string {
  const parts: string[] = [];
  if (s.going.length) parts.push(`${s.going.length} going`);
  if (s.maybe.length) parts.push(`${s.maybe.length} maybe`);
  if (s.notGoing.length) parts.push(`${s.notGoing.length} can't go`);
  return parts.length ? parts.join(' · ') : 'No replies yet';
}
