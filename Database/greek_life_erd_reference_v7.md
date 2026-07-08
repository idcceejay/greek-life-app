# Greek Life App — ERD Reference (v7)

v7 builds directly on **v6** (`greek_life_erd_reference_v6.md`, kept in this folder — read it
first; every v6 table is unchanged unless listed under *Fixes* below). This doc specifies only
what v7 **adds** and **fixes**, plus the full relationship map and the Mermaid source
(`erd_v7.mermaid`). All v7 changes are implemented in `../supabase/migrations/`.

**Why v7.** v6 nailed identity, orgs, calendar, chat, social, location, and the
ledger-above-rails payments model. What it lacked to actually ship: (1) **moderation** — an
anonymous Yik-Yak-style feed will be rejected by App Review (Guideline 1.2) without
report/block; (2) **push notifications** — chat and dues reminders are the retention loop;
(3) **recurring events + external calendar sync** — the "hybrid calendar engine" on the Gantt
chart had no schema; (4) **polls** — a quick action in the UI layout with no tables;
(5) several v6 rules said "enforce in app/trigger" where a real constraint is possible.

---

## v7 changelog

| # | Change | Kind |
|---|---|---|
| 1 | `reports`, `user_blocks` + `profiles.is_suspended` — UGC moderation (App Review Guideline 1.2) | New domain |
| 2 | `devices`, `notifications`, `notification_prefs` — Expo/APNs push | New domain |
| 3 | `polls`, `poll_options`, `poll_votes` — chapter polls | New domain |
| 4 | `events.rrule`, `events.series_parent_id`, `event_exceptions`, `calendar_feeds` — recurrence + read-only ICS export to Apple/Google Calendar (the "hybrid calendar engine") | Calendar |
| 5 | `messages.reply_to_id`, `message_reactions` — threads & reactions | Chat |
| 6 | Fixed `invitation_status` enum (was `('')` in the old `0001_init.sql`) | Fix |
| 7 | Same-org rail routing is now a real **composite FK**: `charges (org_id, payment_account_id)` → `payment_accounts (org_id, id)` (UNIQUE), replacing v6's "enforce in app/trigger". Same for `payments`. | Fix |
| 8 | `pgcrypto`/`gen_random_uuid()` replaces `uuid-ossp` (modern Supabase default) | Fix |
| 9 | Full index plan (FK btree, GiST on all `geography`, partial indexes for feeds/unpaid charges) | Fix |
| 10 | `updated_at` maintained by one shared trigger fn; `posts.score`/`comments.score` maintained by vote triggers | Fix |
| 11 | Complete RLS policy set with `security definer` helper fns (`is_org_member`, `is_org_admin_or_treasurer`, `is_student`, …) — the v6 "Access & role rules" section, as code | Fix |
| 12 | `locations` retention: 90-day purge via `pg_cron`; append-only (no UPDATE policy) | Fix |
| 13 | New view `chat_unread_counts`; kept `latest_locations`, `member_birthdays`, `member_balances` | Views |

---

## New tables

### reports
Any user can report a post, comment, message, or profile. Reviewed by org admins (chapter
scope) or us (campus scope). Required for App Store approval of anonymous content.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| reporter_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| target_type | report_target | NN | | `post`, `comment`, `message`, `profile`. |
| target_id | uuid | NN | | Polymorphic id of the reported row. |
| reason | report_reason | NN | | `harassment`, `hate`, `spam`, `danger`, `other`. |
| detail | text | | | Free text. |
| status | report_status | NN | `'open'` | `open`, `actioned`, `dismissed`. |
| resolved_by | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| created_at | timestamptz | NN | `now()` | |
| resolved_at | timestamptz | | | |

### user_blocks
Blocker never sees blocked content (filter in feed/chat queries). **UNIQUE (blocker_id, blocked_id).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| blocker_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| blocked_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. CHECK `blocker_id <> blocked_id`. |
| created_at | timestamptz | NN | `now()` | |

Also: **`profiles.is_suspended boolean NN DEFAULT false`** — platform-level kill switch; RLS
denies all writes from suspended accounts.

### devices
Push tokens (Expo push token or raw APNs/FCM). **UNIQUE (push_token).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| push_token | text | UK, NN | | |
| platform | device_platform | NN | | `ios`, `android`, `web`. |
| last_seen_at | timestamptz | NN | `now()` | |
| created_at | timestamptz | NN | `now()` | |

### notifications
In-app inbox; push fan-out handled by an Edge Function reading this table.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. Recipient. |
| kind | notification_kind | NN | | `chat_message`, `event_invite`, `event_reminder`, `rsvp_update`, `dues_charge`, `dues_reminder`, `payment_receipt`, `membership`, `poll`, `moderation`. |
| title | text | NN | | |
| body | text | | | |
| deep_link | text | | | e.g. `app://chat/{id}`. |
| data | jsonb | | | Payload (ids). |
| read_at | timestamptz | | | Null = unread. |
| created_at | timestamptz | NN | `now()` | |

### notification_prefs
1:1 with profiles (PK = user). Booleans per `notification_kind` family: `chat`, `events`,
`dues`, `social`, `quiet_hours_start/end time`.

### polls / poll_options / poll_votes
`polls`: `id PK`, `org_id FK NN → organizations CASCADE`, `created_by FK → profiles SET NULL`,
`question text NN`, `is_anonymous boolean NN default true`, `multi_select boolean NN default false`,
`closes_at timestamptz`, `created_at`. `poll_options`: `id PK`, `poll_id FK NN CASCADE`,
`label text NN`, `position int NN`, **UNIQUE (poll_id, position)**. `poll_votes`: `id PK`,
`poll_id FK NN CASCADE`, `option_id FK NN → poll_options CASCADE`, `user_id FK NN → profiles
CASCADE`, `created_at`, **UNIQUE (poll_id, user_id, option_id)** and (when `multi_select=false`)
partial **UNIQUE (poll_id, user_id)**.

### Calendar (hybrid engine)
- **`events.rrule text`** — iCalendar RFC 5545 RRULE (e.g. `FREQ=WEEKLY;BYDAY=MO`). Null = one-off.
- **`events.series_parent_id uuid FK → events(id) ON DELETE CASCADE`** — materialized override
  instance points at its series master.
- **`event_exceptions`**: `id PK`, `event_id FK NN → events CASCADE` (the series master),
  `occurs_on date NN`, `is_cancelled boolean NN default true`, `override_event_id FK → events SET NULL`,
  **UNIQUE (event_id, occurs_on)**. Client expands RRULE locally; exceptions cancel/replace occurrences.
- **`calendar_feeds`**: per-user secret ICS URL so the org calendar subscribes into Apple/Google
  Calendar (read-only export — the pragmatic half of "hybrid sync"; OAuth two-way sync is post-MVP).
  `id PK`, `user_id FK NN CASCADE`, `org_id FK → organizations CASCADE` (null = all my orgs),
  `token text UK NN`, `created_at`, `revoked_at`.

### Chat upgrades
- **`messages.reply_to_id uuid FK → messages(id) ON DELETE SET NULL`** — lightweight threads.
- **`message_reactions`**: `id PK`, `message_id FK NN CASCADE`, `user_id FK NN CASCADE`,
  `emoji text NN`, **UNIQUE (message_id, user_id, emoji)**.

## New enums
`report_target (post, comment, message, profile)` · `report_reason (harassment, hate, spam,
danger, other)` · `report_status (open, actioned, dismissed)` · `device_platform (ios, android,
web)` · `notification_kind (chat_message, event_invite, event_reminder, rsvp_update, dues_charge,
dues_reminder, payment_receipt, membership, poll, moderation)`.

---

## Fixes in detail

**Rail routing as a constraint (was app-enforced in v6).** `payment_accounts` gains
`UNIQUE (org_id, id)`. `charges` and `payments` reference it with a composite FK
`(org_id, payment_account_id) REFERENCES payment_accounts (org_id, id)` — a charge can now
never point at another org's rail. (`payments.org_id` added, denormalized from its charge,
trigger-set.) The category→rail rule (`national_dues` → mandated rail) and the
"application fee only on stripe_connect" rule are trigger-enforced (`trg_charges_route`,
`trg_payments_app_fee`).

**Vote scores.** `posts.score` / `comments.score` are maintained by `AFTER INSERT/UPDATE/DELETE`
triggers on the vote tables — no client writes to `score` (RLS denies it).

**Indexes (high-traffic paths).** GiST: `locations.point`, `events.location`, `posts.point`,
`schools.location`. Partial: `charges (org_id) WHERE status IN ('unpaid','partial')`,
`notifications (user_id) WHERE read_at IS NULL`, `school_affiliations (user_id) WHERE
status='current'` (UNIQUE). Btree on every FK + `messages (chat_id, created_at DESC)`,
`events (org_id, starts_at)`, `posts (school_id, created_at DESC)`, `locations (user_id,
captured_at DESC)`.

**RLS.** Every table has RLS enabled; policies implement the v6 access-rules section verbatim
(student vs alumni tiers, alumni payments carve-out, treasurer scope, invite-only alumni join,
self-promotion ban). See `0003_rls.sql`.

**Location privacy.** `locations` is INSERT-only for the owner (no UPDATE policy exists), reads
require an active shared org membership + `sharing_enabled AND NOT ghost_mode`, and a nightly
`pg_cron` job deletes pings older than 90 days.

---

## Full relationship map (v7 additions only — v6 map still applies)

| Parent | Child | FK column | On delete |
|---|---|---|---|
| profiles | reports | reporter_id / resolved_by | SET NULL |
| profiles | user_blocks | blocker_id / blocked_id | CASCADE |
| profiles | devices | user_id | CASCADE |
| profiles | notifications | user_id | CASCADE |
| profiles | notification_prefs | user_id | CASCADE |
| organizations | polls | org_id | CASCADE |
| polls | poll_options | poll_id | CASCADE |
| polls | poll_votes | poll_id | CASCADE |
| poll_options | poll_votes | option_id | CASCADE |
| profiles | poll_votes | user_id | CASCADE |
| events | events | series_parent_id | CASCADE |
| events | event_exceptions | event_id | CASCADE |
| events | event_exceptions | override_event_id | SET NULL |
| profiles | calendar_feeds | user_id | CASCADE |
| organizations | calendar_feeds | org_id | CASCADE |
| messages | messages | reply_to_id | SET NULL |
| messages | message_reactions | message_id | CASCADE |
| profiles | message_reactions | user_id | CASCADE |
| payment_accounts (org_id,id) | charges (org_id,payment_account_id) | composite | RESTRICT |
| payment_accounts (org_id,id) | payments (org_id,payment_account_id) | composite | RESTRICT |
