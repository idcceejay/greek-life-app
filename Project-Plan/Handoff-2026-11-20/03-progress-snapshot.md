# Rally progress snapshot, 11/20/26

This snapshot comes from reading the repo on 11/20/26 (`main` plus this branch). It isn't a
test of the live app. Where a fact comes from a doc rather than the code, the source is named.

## Timeline

- The launch target in `CLAUDE.md` and `Project-Plan/Launch-Plan.md` is **08/31/2026**. That
  date has passed and the app is **not** on the App Store. The plan needs a new date.
- Last commit on `main`: **10/06/2026** ("Calendar: show the date after the weekday on event
  cards"). Nothing reached `main` between then and this session.
- Per `UNFORGET.md` S4, **no EAS build has ever reached Apple**: TestFlight shows No Builds.

## What exists in the code

Screens in `app/`: Sign in, Onboarding, the tabs Map · Chats · Home · Calendar · Feed, a chat
thread (`chat/[id]`), Dues, Members, Settings.

| Area | What the repo shows |
|---|---|
| Auth | Email sign-in with an 8-digit code (`app/sign-in.tsx`), onboarding, and a sign-in gate in `app/(tabs)/_layout.tsx` |
| Calendar | Day / Week / Month views, create and delete events, yearly repeats. Since 10/06 it also shows Apple/Google calendar events from the phone |
| Chats | Group chats, live messages, invite codes, add by username |
| Members | `app/members.tsx` has usernames, role chips and pending/approve logic (commit `7199c10`) |
| Map | Live member map, foreground-only, ghost-mode switch. No background tracking, by owner decision |
| Feed | Anonymous posts and voting, with report and block in `app/(tabs)/feed.tsx`. **Cut from v1** per UNFORGET U2 (target 1.1), but the Feed tab is still in the tab bar |
| Dues | Dues screen with real deadlines; Stripe edge functions are written but **not deployed** (UNFORGET P3, needs an LLC) |
| RSVP | **Not in the code.** Built once, lost with the dead Windows PC (UNFORGET P1) |
| Push notifications, stickers | **Not in the code** |
| Tests | Vitest: dues data layer and Stripe webhook (`npm test`; 61/61 passed per UNFORGET S7, 10/01) |
| Database | Migrations `0001`–`0010` in `supabase/migrations/`. `CLAUDE.md` says 0001–0006 are applied; **whether 0007–0010 are applied to the hosted project isn't recorded**. Check before planning |
| QA automation | QA Swarm added 11/20 on branch `claude/laughing-davinci-89ho7y`, never run (see `01-this-session.md`) |
| Versions | `expo` ~54.0.37, `react` 19.1.0, `react-native` 0.81.5 (pinned) |

## Open 🔴 THIS rows in `UNFORGET.md` (block the 1.0 App Store submission)

| # | Blocker | Owner |
|---|---|---|
| S2 | App Review sign-in is blank, and a reviewer can't receive the emailed code. Needs a demo-account decision (S9 depends on the same decision) | Ceejay |
| S3 | 0 of 10 screenshots in App Store Connect; at least 3 required | Ceejay |
| S4 | No EAS build has ever reached TestFlight | Ceejay |
| S5 | Terms of Use not linked in the app (Guideline 1.2) | TJ |
| S6 | Pricing, Availability and Content Rights unset in App Store Connect | Ceejay |
| A1 | `app/settings.tsx` links point at `rallyapp.com`, a domain Rally doesn't own | TJ |
| A2 | Cross-chapter security (RLS) audit never run; Rally holds student location data | Cooper |

Other open rows: P1 RSVP rebuild, S8 message paging, S9 QA test login, A4 react-native-maps
caret, A5 error messages, A6 large-text date pickers, U3 SDK 54 vs Expo Go 57 on the phone
(owner decision), plus LATER/SOMEDAY items. See `UNFORGET.md` for the full table.

## Docs that are out of date (worth fixing in the new plan)

- `CLAUDE.md` still gives **08/31/2026** as the launch target, and its "Next tasks" list dates
  from July. Member management already exists in the code, and the feed was cut from v1.
  `UNFORGET.md` is more current.
- `CLAUDE.md` says `lib/mock.ts` demo data renders when `.env` is absent. `lib/data.ts` says
  "There is no mock/demo data anywhere in the app", and a build without server settings shows
  "Rally isn't configured" instead.
- `Launch-Plan.md` and `Road-to-App-Store.md` still use the summer schedule.
- The `rally-guardrails` skill still describes the Windows `start-app.bat` + Expo Go on iPhone
  setup. The dev machine is now a Mac, and Expo Go on the phone is SDK 57 (U3).
- `AGENTS.md` points at Expo **v57** docs, but the app is on SDK **54**.

## Decisions waiting on Ceejay

1. **Demo/test login** (S2 + S9): a reviewer mailbox, a fixed code for one address, or a
   password test account.
2. **SDK 54 vs 57** (U3): upgrade, or stay on 54 and use an EAS development build on the phone.
3. **New launch date**, and whether the feed stays cut from 1.0.
4. **Merge** `claude/laughing-davinci-89ho7y` (QA Swarm + S9 + these notes) into `main`.
