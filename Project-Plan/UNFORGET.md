# Rally — UNFORGET
<!-- unforget-format: v2 -->
**Last promoted:** 2026-10-01 (init)
**Currently shipping toward:** App Store build 1.0 (1)

The roadmap (`Road-to-App-Store.md`) is the launch plan. This file is the index of what got put off.
🔴 THIS blocks the 1.0 submission. Every 🔴 row must be closed or demoted with a reason before we submit.

## 1. Paused plans

| # | Target | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | 🔵 NEXT | RSVP UI was built then lost with the dead Windows SSD; never pushed | 🟡 HIGH | 🟢 Medium | 🟢 Medium | 🟠 Excellent | 🟢 2–5 | Medium | `@status:open` Must be rebuilt from scratch on a branch | TJ |
| P2 | 🟡 LATER | Migration 0011 moderator queue draft lost with the SSD; never pushed | 🟢 MEDIUM | 🟡 High | 🟡 High | 🟢 Good | 🟢 2–5 | Medium | `@status:open` Only needed when the feed ships in 1.1 | Cooper |
| P3 | 🟡 LATER | Three Stripe edge functions written but not deployed; blocked on forming an LLC | 🟢 MEDIUM | 🟢 Medium | 🟢 Medium | 🟢 Good | 🟢 2–5 | Small | `@status:blocked` Stripe Connect requires a legal entity | Ceejay |

### Detail - Paused plans
- **P1** - Built 2026-08-24 in a worktree: `RsvpStatus`/`RsvpRow`/`RSVP_OPTIONS` plus `setRsvp`/`clearRsvp` in `lib/data.ts`, and an attendee sheet in `app/(tabs)/calendar.tsx`. Committed locally, never pushed. The drive died 2026-09-30 and no RSVP branch exists on origin. Roughly 3 hours of work. The `event_rsvps` table still exists and is still unused. Deferred because: `external-block` (the code is gone, not deprioritized). **Verify-still-open:** `grep -rn "RSVP_OPTIONS\|setRsvp" lib app` — expect no match. A match means someone rebuilt it.
- **P2** - Drafted 2026-08-24 as `supabase/migrations/0011_moderation_queue.sql`: `suspended_at` on `profiles`, a `SECURITY DEFINER` RPC for pre-publish filtering, revoking direct INSERT on `posts`, and dropping the auto-hide threshold from 3 reports to 2. Never applied, never pushed. The anonymous feed was cut from v1 on 2026-08-24, so this is no longer a 1.0 blocker. Deferred because: `scope`. **Verify-still-open:** `ls supabase/migrations/` — expect the list to stop at 0010.
- **P3** - `supabase/functions/stripe-{connect-link,checkout,webhook}/index.ts` are written. Deploy needs `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Supabase secrets, `stripe-webhook` deployed with `--no-verify-jwt`, and a Stripe webhook endpoint for `checkout.session.completed` and `account.updated`. Dues work today without Stripe: treasurers record cash and Venmo by hand. Deferred because: `external-block`.

## 2. Session spillover

| # | Target | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 | 🔴 THIS | Rally has never rendered on any device or simulator | 🔴 CRITICAL | ⚪ Low | 🔴 Critical | 🟠 Excellent | ⚪ 1 file | Trivial | `@status:open` Xcode 27 installed; manual simulator path in CLAUDE.md; close when Ceejay confirms a screen rendered | Ceejay |
| S2 | 🔴 THIS | App Review sign-in blank, and 8-digit email OTP means a reviewer cannot log in | 🔴 CRITICAL | 🟢 Medium | 🔴 Critical | 🟠 Excellent | 🟢 2–5 | Medium | `@status:open` Needs a demo-account design decision | Ceejay |
| S3 | 🔴 THIS | Screenshots 0 of 10 in App Store Connect; minimum 3 required | 🟡 HIGH | ⚪ Low | 🔴 Critical | 🟠 Excellent | ⚪ 1 file | Small | `@status:blocked` Blocked by S1 | Ceejay |
| S4 | 🔴 THIS | TestFlight shows No Builds; no EAS build has ever reached Apple | 🔴 CRITICAL | 🟢 Medium | 🔴 Critical | 🟠 Excellent | 🟢 2–5 | Medium | `@status:open` Pipeline never exercised end to end | Ceejay |
| S5 | 🔴 THIS | Terms of Use not linked in-app; Guideline 1.2 needs terms users agree to | 🟡 HIGH | ⚪ Low | 🔴 Critical | 🟠 Excellent | ⚪ 1 file | Small | `@status:open` settings.tsx links only a privacy URL | TJ |
| S6 | 🔴 THIS | Pricing, Availability and Content Rights still unset in App Store Connect | 🟢 MEDIUM | ⚪ Low | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial | `@status:open` About 10 minutes of form filling | Ceejay |
| S7 | 🔵 NEXT | Dues and Stripe-webhook tests sit unmerged on origin/worktree-dues-tests | 🟢 MEDIUM | ⚪ Low | 🟢 Medium | 🟢 Good | 🟢 2–5 | Small | `@status:open` Survived the SSD; needs review and merge | Cooper |
| S8 | 🔵 NEXT | Feed and chat messages load a fixed 50 rows and stop | 🟢 MEDIUM | 🟢 Medium | 🟢 Medium | 🟢 Good | 🟢 2–5 | Medium | `@status:open` Cursor-based, not offset | TJ |

### Detail - Session spillover
- **S1** - Typecheck has passed since August but no screen has ever been rendered. The Windows machine never got Expo Go to connect (`exp://192.168.1.185:8081` timed out, never diagnosed). The Mac removes the problem: Xcode's iOS Simulator runs Metro and the app on one machine with no Wi-Fi hop. Deferred because: `external-block`. **Verify-still-open:** `xcrun simctl list devices available | grep iPhone` — no output means Xcode still is not ready.
- **S2** - "Sign-in required" is checked in App Store Connect but username, password and all contact fields are empty. Rally has no password, only an 8-digit code emailed to the user, which a reviewer cannot receive. Options, best first: (1) a review mailbox we can hand reviewers access to; (2) a fixed static code for one hardcoded address, explained in the Notes field; (3) a video walkthrough, which reviewers often still reject. This is the single most likely cause of a 1.0 rejection. Deferred because: `user-decision`.
- **S3** - Needs 1242×2688, 1284×2778, 2688×1242 or 2778×1284. Simulator screenshots are acceptable to Apple. Deferred because: `scaffolding` (needs S1).
- **S4** - `eas build --profile production` then `eas submit`. `eas.json` already carries `appleId`, `ascAppId` 6797647574 and `appleTeamId` 58V44D98GX, and bakes the `EXPO_PUBLIC_*` values into builds. Deferred because: `scaffolding`.
- **S5** - `app/settings.tsx:230` opens `PRIVACY_URL` and nothing links `https://rallyorgs.com/terms`. Guideline 1.2 applies because group chat is user-generated content even with the feed cut. The terms page is live and carries the zero-tolerance clause. **JS-only**, so it can ship as an Expo OTA update later, but it should be in the 1.0 build. Deferred because: `scope`. **Verify-still-open:** `grep -n "terms" app/settings.tsx` — expect no match.
- **S6** - Everything else on the version page is done: subtitle, both categories, promotional text, description, keywords, support URL, marketing URL, copyright, privacy policy URL, and a 13+ age rating. Deferred because: `scope`.
- **S7** - Branch adds `vitest.config.ts`, `tests/lib/dues.test.ts`, `tests/functions/stripe-webhook.test.ts` and doubles for Stripe and supabase-admin. It was cut before the accessibility pass merged, so it needs a rebase onto current `main`. This is the only coverage on code that moves money. Deferred because: `scope`.
- **S8** - `app/(tabs)/feed.tsx` and `app/chat/[id].tsx`. Use `created_at` cursors, not offset, because offset breaks when rows are inserted mid-scroll. **JS-only.** Deferred because: `scope`.

## 3. Audit findings

| # | Target | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | 🔴 THIS | settings.tsx:30-31 point at rallyapp.com, a domain we do not own | 🔴 CRITICAL | ⚪ Low | 🔴 Critical | 🟠 Excellent | ⚪ 1 file | Trivial | `@status:open` Two string constants; fix is ready | TJ |
| A2 | 🔴 THIS | Cross-org RLS audit never run; Rally holds student location data | 🔴 CRITICAL | 🟡 High | 🔴 Critical | 🟠 Excellent | 🟡 6–15 | Medium | `@status:open` Highest unverified security risk | Cooper |
| A3 | 🔵 NEXT | CLAUDE.md says com.rallyapp.mobile; app.json says com.rallygreek.rally | 🟢 MEDIUM | ⚪ Low | 🟢 Medium | 🟢 Good | ⚪ 1 file | Trivial | `@status:closed` CLAUDE.md fixed 2026-10-01 | Ceejay |
| A4 | 🔵 NEXT | react-native-maps declared ^1.20.1; the caret violates the pinning rule | 🟡 HIGH | 🟢 Medium | 🟡 High | 🟠 Excellent | ⚪ 1 file | Trivial | `@status:open` Likely why the map shows a grey placeholder | TJ |
| A5 | 🔵 NEXT | Failures surface as raw Postgres strings on several screens | 🟢 MEDIUM | ⚪ Low | 🟢 Medium | 🟢 Good | 🟡 6–15 | Medium | `@status:open` Needs a shared error-mapping helper | TJ |

### Detail - Audit findings
- **A1** - `const SUPPORT_EMAIL = 'support@rallyapp.com'` and `const PRIVACY_URL = 'https://rallyapp.com/privacy'`, both with `// TODO` comments. The real values are `support@rallyorgs.com` (live, forwarding to Gmail via Cloudflare Email Routing) and `https://rallyorgs.com/privacy` (live). A reviewer tapping either link in-app lands nowhere. **Trivial and single-file: this should be fixed rather than carried.** **JS-only.** Deferred because: `user-decision` (awaiting approval to edit). **Verify-still-open:** `grep -n "rallyapp.com" app/settings.tsx` — expect two matches.
- **A2** - Sign in as a member of Org A and attempt to read Org B's events, messages, locations, dues and profiles. A read-only probe script wrapped in a rolled-back transaction was planned as `supabase/rls_probe.sql` but was never written. Policies live in `0003_rls.sql`. Nothing here is verified by test, only by reading the policies. Deferred because: `external-block` (Cooper was out sick 2026-08-24). 
- **A3** - **CLOSED 2026-10-01: CLAUDE.md now says `com.rallygreek.rally`.** `app.json` is authoritative and matches App Store Connect, the Apple team and `eas.json`. `CLAUDE.md` is simply stale and will mislead whoever reads it next. The bundle ID itself is still unlocked because no build has been uploaded, so it could be changed to match `rallyorgs.com` as `com.rallyorgs.rally` if we want to before S4. **Verify-still-open:** `grep -i "com.rallyapp.mobile" CLAUDE.md` — expect one match.
- **A4** - Installed 1.29.0 against a declared `^1.20.1`. The native module version does not match what Expo Go bundles, `require` throws, and the try/catch in `app/(tabs)/map.tsx` swallows it, which is why the map falls back to the grey styled placeholder. Fix is `npx expo install react-native-maps --fix`. Never run `npm update`. **Native**, so it needs a new build, not an OTA update. **Verify-still-open:** `grep '"react-native-maps"' package.json` — expect `^1.20.1`.
- **A5** - Screens affected: sign-in, onboarding, settings, members, dues, chats, chat/[id], calendar, feed, map, home. Add one shared helper mapping Supabase errors to human text rather than repeating strings. Additive only; do not change layout, spacing or working copy. **JS-only.** Deferred because: `scope`.

## 4. User-reported / observed

| # | Target | Finding | Urgency | Risk: Fix | Risk: No Fix | ROI | Blast Radius | Fix Effort | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| U1 | ⚪ SOMEDAY | Expo Go timed out reaching Metro on the old Windows machine | ⚪ LOW | ⚪ Low | ⚪ Low | 🟡 Marginal | ⚪ 1 file | Trivial | `@status:withdrawn` That machine is dead; the Mac uses the Simulator | Ceejay |
| U2 | 🟡 LATER | Anonymous campus feed (Yik Yak style) deferred out of v1 | 🟢 MEDIUM | 🔴 Critical | 🟢 Medium | 🟢 Good | 🔴 >15 | Large | `@status:open` Target 1.1; will raise the age rating | Ceejay |
| U3 | 🔵 NEXT | iPhone's Expo Go is now SDK 57; Rally (SDK 54) no longer opens on the phone | 🟡 HIGH | 🟡 High | 🟢 Medium | 🟠 Excellent | 🟡 6–15 | Medium | `@status:open` Owner decision: upgrade to SDK 57, or EAS dev build | Ceejay |
| U4 | 🟡 LATER | Xcode 27 replaced Simulator.app with Device Hub; SDK 54 CLI `i` key fails | 🟢 MEDIUM | ⚪ Low | ⚪ Low | 🟢 Good | ⚪ 1 file | Trivial | `@status:open` Manual simctl workaround documented in CLAUDE.md | Ceejay |

### Detail - User-reported / observed
- **U1** - **CLOSED 2026-10-01: withdrawn — the Windows machine failed permanently and the work moved to a Mac, where the iOS Simulator removes the network hop entirely.** Never diagnosed: candidates were Windows Firewall on TCP 8081, a Public network profile, or a VPN or virtual adapter capturing the route.
- **U2** - Cut from v1 on 2026-08-24. Shipping it requires all of: a pre-publish content filter enforced in the database (because `createPost` inserts straight from the client and a client-side filter is bypassable), a moderator queue with 24-hour removal and eject, `suspended_at` on profiles, a custom EULA users agree to, and a working support inbox. Migration P2 covers the database half. Expect the age rating to move from 13+ toward 17+; Yik Yak itself shipped at 17+. Guideline 1.2. Deferred because: `user-decision`.
- **U3** - Found 2026-10-01. The App Store only ships the newest Expo Go and iOS can't install an older one, so the phone path that the SDK 54 pin was protecting is gone. Options: (1) upgrade to SDK 57 with `npx expo install expo@^57.0.0` then `npx expo install --fix` on a branch, then re-test every screen (React and React Native versions move with it); (2) stay on 54 and use an EAS development build on the phone (needs the Apple Developer account, already active). Production/TestFlight builds don't use Expo Go, so this does not block S4. Deferred because: `user-decision`.
- **U4** - Found 2026-10-01. @expo/cli 54.0.27 has no Device Hub support, so `i` fails with "Can't determine id of Simulator app". Fixed in newer CLIs (@expo/cli 56.1.25+); the SDK 54 backport (expo/expo#50250) hadn't shipped. Workaround: start Metro logged in or with `--offline`, boot a simulator with `xcrun simctl boot`, install the Expo Go SDK 54 simulator build once, then `xcrun simctl openurl booted exp://127.0.0.1:8081`. Goes away on its own if U3 is resolved by upgrading. Deferred because: `external-block`. **Verify-still-open:** `npm ls @expo/cli` — 54.0.27 or lower means still open.
