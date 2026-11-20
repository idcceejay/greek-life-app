# App Review sign-in (UNFORGET S2)

Rally has no password. Supabase emails an 8-digit one-time code, so a reviewer
must be able to open the mailbox themselves. `support@rallyorgs.com` cannot be
used: it runs on Cloudflare Email Routing, which forwards only and has no inbox
to sign into.

## Setup, in order

1. Create a free mailbox for review only, e.g. `rallyreview@gmail.com`.
   Use a password that is not reused anywhere else.
2. In Rally, sign in with that address once and finish onboarding. This creates
   the `auth.users` and `profiles` rows.
3. Run `supabase/app_review_account.sql` in the Supabase SQL editor, with
   `REPLACE_ME@gmail.com` swapped for the real address in all three places.
   It promotes that one account to the student tier so the member map is
   reachable. It does not make consumer domains campus-wide.
4. Join or create a chapter on that account and add a couple of events, so the
   reviewer sees populated screens rather than empty states.
5. Fill in App Store Connect → the version → App Review Information.

## App Store Connect fields

- **Sign-in required:** checked
- **User name:** the review mailbox address
- **Password:** the Rally field has no password. Put a placeholder such as
  `see Notes` here, and the mailbox password in Notes.
- **Contact:** first name, last name, phone, email — all four are required.

## Notes field — paste this, with the placeholders filled in

> Rally uses passwordless sign-in. There is no password for the app account.
>
> 1. On the sign-in screen, enter: <REVIEW_EMAIL>
> 2. Tap "Send code". An 8-digit code is emailed to that address.
> 3. Open that mailbox at https://mail.google.com using
>    <REVIEW_EMAIL> / <MAILBOX_PASSWORD>
> 4. Enter the 8-digit code in the app to finish signing in.
>
> The code is 8 digits, not 6. Codes expire after one hour; tap "Send code"
> again for a fresh one.
>
> The account is pre-joined to a chapter with events so all tabs are populated.
> Location sharing is foreground-only and opt-in, and defaults to off; the
> member map works without enabling it.

## Do not use

A hardcoded static code for a fixed address was considered and rejected. It is a
permanent authentication bypass in an app that stores student location data, and
it would ship in every future release.
