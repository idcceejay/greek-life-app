import { describe, expect, it } from 'vitest';
import { friendlyError } from '../../lib/errors';

describe('friendlyError', () => {
  it('maps Rally RPC codes', () => {
    expect(friendlyError('admins_only')).toBe('Only admins can do that.');
    expect(friendlyError('too_far')).toMatch(/too far/);
  });

  it('maps raw Postgres messages', () => {
    expect(friendlyError('duplicate key value violates unique constraint "profiles_username_key"')).toMatch(
      /already taken/,
    );
    expect(friendlyError('new row violates row-level security policy for table "events"')).toMatch(
      /permission/,
    );
    expect(friendlyError({ message: 'whatever', code: '23505' })).toMatch(/already taken/);
  });

  it('maps network and auth failures', () => {
    expect(friendlyError(new TypeError('Network request failed'))).toMatch(/connection/);
    expect(friendlyError('Token has expired or is invalid')).toMatch(/code is wrong or expired/);
    expect(friendlyError('For security purposes, you can only request this after 52 seconds.')).toMatch(
      /Too many tries/,
    );
  });

  it('hides unmapped technical strings', () => {
    expect(friendlyError('some_new_code')).toBe('Something went wrong. Try again.');
    expect(friendlyError('column "foo" does not exist')).toBe('Something went wrong. Try again.');
    expect(friendlyError('PGRST116: JSON object requested')).toBe('Something went wrong. Try again.');
  });

  it('passes through plain sentences and handles empty input', () => {
    expect(friendlyError('Give the event a title.')).toBe('Give the event a title.');
    expect(friendlyError(null)).toBe('Something went wrong. Try again.');
    expect(friendlyError(undefined, 'Could not save.')).toBe('Could not save.');
  });
});
