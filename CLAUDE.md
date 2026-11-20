# Rally (app name; repo/folder still "greek-life-app") · Project context for Claude

Read this fully before doing anything. Originally the handoff from the Cowork session
that built this repo (July 8–10, 2026); refreshed 11/20/26 for the solo finish.

## What this is

Rally — all-in-one app for Greek life / campus orgs: calendar, group chat, live member map
(Snap-map style), anonymous campus feed, chapter dues. Apple HIG + bento-grid design —
reference: `Project-Plan/Greek Life App — UI Layout.pdf`. Successor to
cooperparrish/College-Orgs-App. **Team (from 11/20/26): Ceejay Raut alone** (owner of this
machine; GitHub `idcceejay`; beginner-friendly explanations appreciated — avoid jargon,
give exact click-by-click steps for anything outside the code). Cooper's backend/security
lane and TJ's screens lane are covered by the Claude Code agents in `.claude/agents/`
(guide: `Project-Plan/Agents-How-To.md`).

**The 08/31/2026 launch was missed. Current plan with dates: `Project-Plan/Launch-Plan-v2.md`
(1.0 submission ~12/01/26, live ~12/08–12/12).** The summer `Launch-Plan.md` and
`Road-to-App-Store.md` are historical.

## Naming

Official app name is **Rally** (set 07/29/26). Display name, slug (`rally`), scheme
(`rally`), and bundle id (`com.rallygreek.rally`, matching `app.json`, `eas.json` and
App Store Connect app 6797647574) all say Rally. The GitHub repo, local
folder, and Supabase project are still named greek-life-app — that's cosmetic, don't
rename them mid-flight. Historical docs in `Database/` keep their original filenames.

## Stack & constraints

- Expo SDK **54**, TypeScript, Expo Router. `react` pinned exactly 19.1.0, `react-native`
  0.81.5 (renderer mismatch otherwise). Do NOT upgrade the SDK without the owner's decision.
  **Pin rationale changed 10/01/26:** the owner's iPhone now has Expo Go for SDK 57 (the App
  Store only ships the newest Expo Go and iOS can't downgrade), so this SDK 54 build no
  longer opens on the phone through Expo Go. Run it in the iOS Simulator (see "Dev machine
  & running the app") or an EAS development build. Upgrade-to-57 vs dev-build is an open
  owner decision tracked in `Project-Plan/UNFORGET.md`.
  Never run `npm update` / `npm audit fix --force` (pulls an incoherent newest-of-everything
  set and breaks the renderer). To change a package, only ever `npx expo install <pkg> --fix`.
  `app.json` plugins must contain ONLY real config plugins (`expo-router`, `expo-location`)
  — adding e.g. `expo-status-bar` there throws PluginError on start.
  Recovery from a broken install (macOS):
  `rm -rf node_modules package-lock.json && npm install --legacy-peer-deps`
  (Windows: `rmdir /s /q node_modules`, `del package-lock.json`, `npm install --legacy-peer-deps`).
- npm needs `--legacy-peer-deps` (already set in `.npmrc`).
- Supabase project (id `cwleqyjhfipezodwbxnm`): Postgres + PostGIS, email OTP auth.
  `.env` holds EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (publishable key). Never commit `.env`.
- The owner is not a fluent terminal user — give exact copy-paste commands and say which
  app/window to paste them into.

## Dev machine & running the app (updated 10/01/26)

- Primary dev machine is now a **Mac**; the repo lives at `~/Developer/greek-life-app`.
  The Windows PC died 09/30/26 — the unpushed RSVP branch and the migration 0011 draft were
  lost with it (UNFORGET P1/P2). If it isn't on GitHub, assume it doesn't exist.
- Toolchain: Node 22 LTS, git, Homebrew, GitHub CLI (`gh auth login`), Claude Code in
  `~/.local/bin` (on PATH via `~/.zshrc`), **Xcode 27**.
- **Xcode 27 has no Simulator.app** — it was replaced by **Device Hub**. The SDK 54 Expo CLI
  (@expo/cli 54.0.27, the newest for SDK 54) doesn't know about Device Hub, so pressing `i`
  in `npx expo start` fails with "Can't determine id of Simulator app". The SDK 54 backport
  (expo/expo#50250) hadn't shipped as of 10/01/26. `sudo xcode-select -s ...` and
  `open -a Simulator` do NOT fix it — don't suggest them.
- **How to load Rally in the simulator (manual path that works):**
  1. Start Metro **logged in to Expo, or offline** — "Proceed anonymously" is NOT enough
     for the simulator to load Rally:
     - `npx expo start --offline`, **or**
     - `npx expo login` (owner's account `idc_ceejay`), then `npx expo start`.
  2. Boot a simulator: `xcrun simctl list devices available`, then
     `xcrun simctl boot "iPhone 17"` (any listed name). Open Device Hub to see it.
  3. One-time per simulator: install Expo Go for SDK 54. Download the simulator build
     (`iosClientUrl` for 54.0.0 at https://api.expo.dev/v2/versions/latest, or
     https://expo.dev/go?sdkVersion=54&platform=ios&device=false), extract it, then
     `xcrun simctl install booted "<path to the extracted .app>"`.
  4. `xcrun simctl openurl booted exp://127.0.0.1:8081`
- `npx expo login` gotcha: the password prompt shows nothing while you type. Pressing Enter
  on a blank field gives `AssertionError ... (username && password)` — type it blind, then
  Enter.
- Windows (legacy, only if a teammate is on Windows): `start-app.bat` was the old launcher;
  PowerShell may block npm (`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` fixes it,
  or use Command Prompt); `cp` -> `copy`.

## Database

- Schema doc: `Database/greek_life_erd_reference_v7.md` (+ v6, both authoritative) and
  `Database/erd_v7.mermaid`.
- Migrations **0001–0010 are applied** to the hosted project (checked live 11/20/26).
- **0011_lock_down_rpcs.sql and 0012_close_probe_leaks.sql are written but NOT yet applied**
  (the owner pastes them, 0011 first). They close real holes found 11/20: the Stripe
  bookkeeping RPCs were callable by anyone, any user could join any chat, RSVPs crossed
  chapters, and birthday/phone were readable campus-wide. Update this line once applied.
- `supabase/rls_probe.sql` is the cross-chapter security test. It is ONE statement that
  ends in RAISE EXCEPTION, so it always rolls back; the "error" is the report. Run it after
  every migration that touches RLS or RPCs (rally-security agent).
- The location-circles branch (`worktree-location-circles`, Mac only until pushed) has its
  own `0011_location_circles.sql`. Renumber it to the next free number when merging (1.1).
- Kennesaw State + `kennesaw.edu` / `students.kennesaw.edu` are seeded (live, 11/20/26).

## App state

Working end-to-end against the live Supabase project (July 29, 2026):
- Auth: email OTP (`app/sign-in.tsx`, 8-digit codes), onboarding (`ensure_profile`),
  gate in `app/(tabs)/_layout.tsx` via `lib/useSession.ts`. Sign out = tap Home avatar.
  Supabase email templates (Confirm signup + Magic Link) customized to send `{{ .Token }}`
  via Gmail SMTP.
- `lib/data.ts` is the single live-data layer (orgs, events, RSVPs, chats, messages, posts,
  invites, user search). Screens must render empty states. There is NO mock/demo data: a
  build without `.env` shows "Rally isn't configured". Show errors with
  `friendlyError()` (`lib/errors.ts`) and `<ErrorText>` (`components/ui.tsx`).
- **Feature switches: `lib/features.ts`.** For 1.0, `dues: false` (hidden until LLC +
  Stripe; returns as "Money", see Launch-Plan-v2 Phase 5) and `feed: false` (cut 08/24).
  Don't delete dues/feed code; check the switch before linking to either.
- Home: org create/join flow (`create_organization` RPC), live next-event/chat/feed cards.
- Calendar: Day (agenda) / Week (Sun–Sat strip) / Month (grid) all functional, prev/next,
  event dots, create via native date+time pickers, `FREQ=YEARLY` repeat expanded
  client-side ±1 year, hold-to-delete. Tap an event → detail sheet with RSVP (Going /
  Maybe / Can't go), who's going, add to phone calendar, edit/delete (creator or admin).
  Apple/Google phone calendars show alongside (expo-calendar, on-device only).
- Chats: real list, atomic `create_group_chat` RPC, realtime messages, invite codes
  (`create_chat_invite` + `join_chat_via_invite`), add-by-username (`search_users` +
  `add_chat_member_by_username`).
- Feed: real anonymous posts + voting (students only). **Hidden in 1.0** (feature switch).
- Members (`app/members.tsx`): roster, approve/decline join requests, roles. Settings:
  account deletion, block list, support/privacy/terms links (rallyorgs.com).
- Dues (`app/dues.tsx`, `lib/dues.ts`): ledger works, **hidden in 1.0** (feature switch).
- Map: react-native-maps loaded dynamically (Expo Go lacks the native module → styled
  fallback), foreground-only pings, ghost mode, location-verified check-in.
  **No background tracking / speed features — owner explicitly rejected those.**
- `components/Sheet.tsx`: shared spring bottom sheet (keyboard-aware). Use it for all
  modal forms — do not go back to RN `Modal animationType="slide"` (too slow).

Anything RLS blocks from the client in two steps should become a SECURITY DEFINER RPC (see
0005/0006 for the pattern) with an auth.uid() + role check inside, `SET search_path =
public`, and `REVOKE EXECUTE ... FROM PUBLIC, anon` (since 0011, new functions no longer
default to PUBLIC/anon; server-only ones must also revoke from `authenticated`).

Test data: `supabase/dev_seed_test_school.sql` exists but the consumer email domains were
REMOVED again (real .edu required for new signups). Existing accounts
(ceejayraut@gmail.com, cparrish03888@gmail.com) were force-set to student tier.

## RESOLVED blockers (do not redo)

Auth emails: Gmail SMTP is configured and both templates send `{{ .Token }}`. Sign-in works.
Codes are 8 digits, not 6 — don't cap the input at 6.

## Next tasks

The dated plan is `Project-Plan/Launch-Plan-v2.md`; the blocker list is the 🔴 rows in
`Project-Plan/UNFORGET.md`. Short version (11/20/26):
1. Owner pastes 0011 then 0012, then runs `supabase/rls_probe.sql` (expect no LEAK lines).
2. App Review mailbox account + demo chapter (`Project-Plan/App-Review-Notes.md`).
3. rally-release agent → `eas build --profile production` → `eas submit` → TestFlight.
4. Screenshots, App Store Connect pricing/availability/privacy → submit for review.
After launch: push notifications, SDK 57 upgrade, location circles, pagination, then Money
(Stripe after the LLC) and later the anonymous feed.

## Conventions

- Design tokens in `lib/theme.ts` (since 10/01/26: slate #374151 + rose accent #E11D48,
  canvas #F3F4F6, radius 20 cards). Never hard-code colours.
- Money = integer cents. Timestamps = timestamptz. RLS on everything; client never
  writes scores/status fields maintained by triggers.
- Push to GitHub `idcceejay/greek-life-app` — on the Mac, `gh auth login` already
  authenticates git. Never ask the owner to paste a token into chat. Never push without
  asking.
- Validate SQL with pglast before handing to the user; they paste migrations into the
  Supabase SQL editor manually (Ctrl+A replace, one file at a time). Against the live DB,
  Claude runs only SELECTs or self-rolling-back statements, and asks first (each call is a
  permission prompt for the owner).
- Checks: `npm run typecheck` and `npm test` (Vitest, `tests/`); GitHub Actions runs both
  on every push (`.github/workflows/ci.yml`).

<!-- unforget:recall:start -->
## Deferred Work Index

**Single source of truth:** `Project-Plan/UNFORGET.md`
Read it when someone asks what's deferred or what's left, and before any App Store
submission (check the 🔴 THIS rows). Log put-off work there as a row; don't start a new
tracking file. The roadmap is the plan; UNFORGET.md is the index of what got deferred.
<!-- unforget:recall:end -->

@AGENTS.md
