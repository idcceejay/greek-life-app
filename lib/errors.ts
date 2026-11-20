/**
 * Turn whatever went wrong into a sentence a member can act on (UNFORGET A5).
 *
 * The data layer (lib/data.ts, lib/dues.ts) keeps returning raw codes and
 * messages, because screens branch on codes like 'admins_only' or 'too_far'.
 * Screens call friendlyError() only on the fallback they DISPLAY, so a raw
 * Postgres string never reaches the user.
 *
 * Pure function, no imports, so it's unit-tested in tests/lib/errors.test.ts.
 */

type ErrorLike = string | { message?: string; code?: string } | null | undefined;

/** Codes returned by Rally's own RPCs as { ok: false, error: '<code>' }. */
const CODE_TEXT: Record<string, string> = {
  not_signed_in: 'Your session ended. Sign in again.',
  not_authorized: "You don't have permission to do that.",
  not_allowed: "You don't have permission to do that.",
  admins_only: 'Only admins can do that.',
  students_only: 'Only verified students can do that. Sign in with your school email.',
  not_a_member: "You're not a member of this chapter.",
  not_same_campus: "That person isn't on your campus.",
  no_such_user: "We couldn't find that person.",
  no_user: "We couldn't find that person.",
  name_required: 'Add a name first.',
  name_too_short: 'That name is too short.',
  bad_amount: 'Enter an amount greater than $0.',
  no_such_charge: "That charge doesn't exist anymore.",
  invalid_or_expired: 'That code is invalid or expired.',
  event_not_found: "That event doesn't exist anymore.",
  checkin_disabled: "Check-in isn't turned on for this event.",
  event_has_no_location: "This event doesn't have a location to check in at.",
  outside_checkin_window: 'Check-in is only open around the event time.',
  too_far: "You're too far from the event to check in.",
  status_not_settable: "That status can't be changed here.",
  invalid_target: "That item can't be reported.",
  no_author: "That post's author can't be found.",
  last_admin: 'A chapter needs at least one admin. Make someone else an admin first.',
  empty: 'Write something first.',
};

/** Patterns in raw Postgres / Supabase / network messages. First match wins. */
const PATTERNS: Array<[RegExp, string]> = [
  [/duplicate key|unique constraint|already exists|23505/i, "That's already taken. Try something different."],
  [/row-level security|permission denied|42501/i, "You don't have permission to do that."],
  [/foreign key|23503/i, 'That item was removed. Refresh and try again.'],
  [/violates check constraint|23514/i, "One of those values isn't allowed. Check the form and try again."],
  [/last admin|at least one admin/i, 'A chapter needs at least one admin. Make someone else an admin first.'],
  [/network request failed|failed to fetch|fetch failed|timeout|timed out|offline/i, "Couldn't reach Rally. Check your connection and try again."],
  [/token has expired|otp.*expired|invalid.*otp|token.*invalid/i, 'That code is wrong or expired. Request a new one.'],
  [/rate limit|too many requests|429|security purposes/i, 'Too many tries. Wait a minute and try again.'],
  [/jwt|session.*(missing|expired)|not authenticated/i, 'Your session ended. Sign in again.'],
];

const FALLBACK = 'Something went wrong. Try again.';

/** Looks like a raw technical string rather than a sentence we wrote. */
function looksTechnical(s: string): boolean {
  return (
    /^[a-z]+(_[a-z]+)+$/.test(s) || // snake_case code we didn't map
    /[{}<>]|\bnull\b|undefined|PGRST|SQLSTATE|relation |column |function |syntax/i.test(s)
  );
}

export function friendlyError(err: ErrorLike, fallback: string = FALLBACK): string {
  if (!err) return fallback;
  const raw = typeof err === 'string' ? err : err.message ?? err.code ?? '';
  const text = raw.trim();
  if (!text) return fallback;

  if (CODE_TEXT[text]) return CODE_TEXT[text];
  for (const [re, msg] of PATTERNS) if (re.test(text)) return msg;
  if (typeof err === 'object' && err.code) {
    for (const [re, msg] of PATTERNS) if (re.test(err.code)) return msg;
  }
  // Already a human sentence (e.g. a message one of our screens wrote)?
  if (!looksTechnical(text) && text.length <= 140) return text;
  return fallback;
}
