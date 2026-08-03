# Rally

*All-in-one app for Greek life, clubs, and campus organizations.*

Rally is the all-in-one app for Greek life, clubs, and campus organizations: calendar, group
messaging, live member map, anonymous campus feed, and chapter dues — in one place,
with an Apple HIG / bento-grid design.

Successor to [cooperparrish/College-Orgs-App](https://github.com/cooperparrish/College-Orgs-App);
the original Gantt chart, technology selection, ERD history, and UI layout live on in
`Project-Plan/` and `Database/`.

## Stack

| Layer | Choice |
|---|---|
| Mobile | React Native (Expo SDK 57, Expo Router, TypeScript) |
| Backend | Supabase — Postgres 15 + PostGIS, Auth, Realtime, Storage, Edge Functions |
| Payments | Stripe Connect (our rail) + reconciliation with mandated Greek platforms |
| Design | Apple Human Interface Guidelines, bento-grid home (`Project-Plan/Rally — UI Layout.pdf`) |

## Repository layout

```
app/                  Expo Router screens
  (tabs)/             Map · Chats · Home · Calendar · Feed
  chat/[id].tsx       Chat thread
components/           Shared UI (bento Card, Avatar, Pill, …)
lib/                  theme tokens, Supabase client, demo data
supabase/
  migrations/         0001 schema · 0002 views · 0003 RLS  (schema v7)
  seed.sql            Local demo seed
Database/             ERD v5 (png) → v6 (reference) → v7 (reference + mermaid)
Project-Plan/         Gantt chart, technology selection, UI layout PDF, launch plan
```

## Getting started

```bash
npm install
cp .env.example .env        # fill in your Supabase URL + anon key
npx expo start              # press i for iOS simulator, or scan with Expo Go
```

Screens render bundled demo data until `.env` is configured, so the full UI is
explorable with zero backend setup.

### Backend

```bash
npm i -g supabase
supabase init && supabase start     # local stack
supabase db reset                    # applies migrations + seed
```

Point `.env` at the local stack or a hosted project. Migrations are plain SQL —
`supabase db push` applies them to a hosted project.

## Status vs. the development schedule

See `Project-Plan/Gannt-Chart.md` (original) and `Project-Plan/Launch-Plan.md`
(re-baselined 07/08/26, launch target unchanged: **08/31/26**).

- [x] Phase 1 — design refs, schema (v7), auth model
- [~] Phase 2 — navigation shell ✅, calendar UI ✅, chat UI ✅ (realtime wiring next), storage/media next
- [ ] Phase 3 — TestFlight, closed beta, launch

## Team

- Cooper Parrish — cooperparrishwork@gmail.com
- Ceejay Raut — ceejayraut@gmail.com
