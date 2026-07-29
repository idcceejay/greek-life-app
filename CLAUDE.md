# Greek Life — All-in-One App · Project context for Claude

Read this fully before doing anything. It is the handoff from the Cowork session
that built this repo (July 8–10, 2026).

## What this is

All-in-one app for Greek life / campus orgs: calendar, group chat, live member map
(Snap-map style), anonymous campus feed, chapter dues. Apple HIG + bento-grid design —
reference: `Project-Plan/Greek Life App — UI Layout.pdf`. Successor to
cooperparrish/College-Orgs-App. Team: Cooper Parrish + Ceejay Raut (owner of this
machine; GitHub `idcceejay`; beginner-friendly explanations appreciated — avoid jargon,
give exact click-by-click steps for anything outside the code).

**Launch target: 08/31/2026 (App Store). Re-baselined plan: `Project-Plan/Launch-Plan.md`.**

## Stack & constraints

- Expo SDK **54** (downgraded from 57 — the user's phone can only run Expo Go v54; do
  NOT upgrade), TypeScript, Expo Router. `react` pinned exactly 19.1.0, `react-native`
  0.81.5 (renderer mismatch otherwise).
  **Verified 07/29/26: latest Expo Go on the App Store is 54.0.2 — SDK 57 needs a custom
  dev build, so stay on 54 until we ship EAS dev builds/TestFlight.** Never run
  `npm update` / `npm audit fix --force` (pulls an incoherent newest-of-everything set and
  breaks the renderer). To change SDK, only ever `npx expo install <pkg> --fix`.
  `app.json` plugins must contain ONLY real config plugins (`expo-router`, `expo-location`)
  — adding e.g. `expo-status-bar` there throws PluginError on start.
  Recovery from a broken install: `rmdir /s /q node_modules`, `del package-lock.json`,
  `npm install --legacy-peer-deps`.
- npm needs `--legacy-peer-deps` (see `start-app.bat`, which is how the user launches).
- Windows: PowerShell may block npm (`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  fixes it); Command Prompt works without that. `cp` -> `copy`.
- Supabase project (id `cwleqyjhfipezodwbxnm`): Postgres + PostGIS, email OTP auth.
  `.env` holds EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (publishable key). Never commit `.env`.
- The user runs the app via `start-app.bat` → Expo Go on iPhone (same Wi-Fi). They do
  not use a terminal fluently; `o`/editor shortcuts don't work (no editor installed).

## Database

- Schema doc: `Database/greek_life_erd_reference_v7.md` (+ v6, both authoritative) and
  `Database/erd_v7.mermaid`.
- Migrations 0001–0003 are **applied** to the hosted Supabase project (schema, views, RLS).
- `0004_features.sql` (event check-ins + `checkin_to_event` RPC with PostGIS distance
  validation, `chat_invites` + `join_chat_via_invite`, sticker pack tables,
  `get_visible_locations`, `ensure_profile`) — **verify it has been run**; the user was
  about to run it when the session ended.
- The `schools` / `school_domains` tables may still be empty or only seeded with the demo
  UGA rows (`supabase/seed.sql`). Student tier requires the user's real school + domains
  rows — likely Kennesaw State (kennesaw.edu / students.kennesaw.edu); confirm with user.

## App state

- All 5 tabs work with demo data (`lib/mock.ts`) when `.env` is absent ("demo mode").
- Auth: `app/sign-in.tsx` (email OTP 6-digit), `app/onboarding.tsx` (ensure_profile RPC),
  gate in `app/(tabs)/_layout.tsx` via `lib/useSession.ts`.
- Map: `app/(tabs)/map.tsx` + `lib/useLiveMap.ts` — react-native-maps, foreground-only
  location publishing (60 s throttle), pins via `get_visible_locations` RPC, ghost mode,
  location-verified event check-in. **No background tracking, no speed features — owner
  explicitly rejected Life360-style speed tracking.**
- Chats/Calendar/Feed/Home still render mock data — wiring them to Supabase is next.

## KNOWN BLOCKER (auth emails)

Supabase now requires **custom SMTP** to edit email templates; default template sends a
magic **link** but the app's sign-in expects a **6-digit code** (`{{ .Token }}`).
Options: set up free SMTP (e.g. Resend) and add `{{ .Token }}` to the Magic Link
template, or rework sign-in to handle magic-link deep links. Until resolved, real
sign-in cannot complete. This is the first thing to fix.

## Next tasks (in priority order)

1. Fix auth email delivery (above), seed the user's real school + email domains.
2. Wire Chats to Supabase Realtime (`chats`/`messages`/`chat_unread_counts`), Calendar to
   `events`/RSVPs, Feed to `posts`/votes, Home to live counts.
3. Chat growth UI: invite links (`chat_invites` schema is live) + user search (username
   citext, RLS limits to same campus/org).
4. Calendar sync: `expo-calendar` device integration (Apple/Google on phone). ICS export
   feed (`calendar_feeds` table) needs an Edge Function. Google OAuth 2-way sync and
   "Flare" integration = post-launch (Flare has no public API).
5. Stickers UI (schema live: `sticker_packs`/`stickers`, `messages.sticker_id`; needs a
   `stickers` storage bucket).
6. TestFlight via EAS Build (Apple Developer enrollment status: user was told to start —
   ask). Moderation UI (report/block) exists in schema, needed for App Review.

## Conventions

- Design tokens in `lib/theme.ts` (accent #5A5CF0, canvas #F2F1F7, radius 20 cards).
- Money = integer cents. Timestamps = timestamptz. RLS on everything; client never
  writes scores/status fields maintained by triggers.
- Push to GitHub `idcceejay/greek-life-app` (user supplies a fine-grained PAT per
  session; remind them to revoke after).
- Validate SQL with pglast before handing to the user; they paste migrations into the
  Supabase SQL editor manually (Ctrl+A replace, one file at a time).

@AGENTS.md
