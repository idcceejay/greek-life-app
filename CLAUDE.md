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

Working end-to-end against the live Supabase project (July 29, 2026):
- Auth: email OTP (`app/sign-in.tsx`, 8-digit codes), onboarding (`ensure_profile`),
  gate in `app/(tabs)/_layout.tsx` via `lib/useSession.ts`. Sign out = tap Home avatar.
  Supabase email templates (Confirm signup + Magic Link) customized to send `{{ .Token }}`
  via Gmail SMTP.
- `lib/data.ts` is the single live-data layer (orgs, events, chats, messages, posts,
  invites, user search). Screens must render empty states; `lib/mock.ts` demo data renders
  ONLY when `.env` is absent (design-preview mode).
- Home: org create/join flow (`create_organization` RPC), live next-event/chat/feed cards.
- Calendar: Day (agenda) / Week (Sun–Sat strip) / Month (grid) all functional, prev/next,
  event dots, create via native date+time pickers, `FREQ=YEARLY` repeat expanded
  client-side ±1 year, hold-to-delete.
- Chats: real list, atomic `create_group_chat` RPC, realtime messages, invite codes
  (`create_chat_invite` + `join_chat_via_invite`), add-by-username (`search_users` +
  `add_chat_member_by_username`).
- Feed: real anonymous posts + voting (students only).
- Map: react-native-maps loaded dynamically (Expo Go lacks the native module → styled
  fallback), foreground-only pings, ghost mode, location-verified check-in.
  **No background tracking / speed features — owner explicitly rejected those.**
- `components/Sheet.tsx`: shared spring bottom sheet (keyboard-aware). Use it for all
  modal forms — do not go back to RN `Modal animationType="slide"` (too slow).

Migrations 0001–0006 are ALL APPLIED to the hosted project. Anything RLS blocks from the
client in two steps should become a SECURITY DEFINER RPC (see 0005/0006 for the pattern).

Test data: `supabase/dev_seed_test_school.sql` exists but the consumer email domains were
REMOVED again (real .edu required for new signups). Existing accounts
(ceejayraut@gmail.com, cparrish03888@gmail.com) were force-set to student tier.

## RESOLVED blockers (do not redo)

Auth emails: Gmail SMTP is configured and both templates send `{{ .Token }}`. Sign-in works.
Codes are 8 digits, not 6 — don't cap the input at 6.

## Next tasks (in priority order)

1. Seed the user's real school + `.edu` domains (Kennesaw State — confirm) so new members
   can sign up as students.
2. Member management: approve/decline pending join requests, promote to admin/treasurer,
   roster screen. Nothing in the UI does this yet.
3. RSVP buttons on events; event edit (create/delete exist).
4. Calendar sync: `expo-calendar` device integration (Apple/Google accounts on the phone).
   ICS export (`calendar_feeds`) needs an Edge Function. Google OAuth two-way sync and
   "Flare" = post-launch (Flare has no public API).
5. Stickers UI (schema live: `sticker_packs`/`stickers`, `messages.sticker_id`; needs a
   `stickers` storage bucket).
6. Push notifications (`devices`/`notifications` tables + Edge Function fan-out).
7. Moderation UI (report/block) — schema exists, REQUIRED for App Review with an anonymous
   feed. Then EAS Build → TestFlight (Apple Developer enrollment: ask; it's the long pole
   for the 08/31 launch).

## Conventions

- Design tokens in `lib/theme.ts` (accent #5A5CF0, canvas #F2F1F7, radius 20 cards).
- Money = integer cents. Timestamps = timestamptz. RLS on everything; client never
  writes scores/status fields maintained by triggers.
- Push to GitHub `idcceejay/greek-life-app` (user supplies a fine-grained PAT per
  session; remind them to revoke after).
- Validate SQL with pglast before handing to the user; they paste migrations into the
  Supabase SQL editor manually (Ctrl+A replace, one file at a time).

@AGENTS.md
