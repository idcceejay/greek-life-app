# Greek Life App — ERD Reference (v6)

Build-ready field reference for the Supabase/PostgreSQL schema. Every column lists its
exact datatype, key role, nullability, default, and (for FKs) the on-delete behavior, so
this doc can be transcribed directly into a schema.

Legend — **PK** primary key · **FK** foreign key · **UK** unique · `NN` not null.
Timestamps are `timestamptz`. Geo is PostGIS `geography(Point,4326)`. Money is stored as
integer **cents** (`integer`), never floats.

v3 changes: added `invitations` (invite-only path for alumni), added required `profiles.birthday`,
and a derived `member_birthdays` view for group calendars.
v4 changes: campus is now a **property of the person** — `school_affiliations` tracks every
school a user has verified at (one `current` at a time, `.edu` domain must match the school);
alumni = a user with no `current` affiliation.
v5 changes: added `school_domains` (a school's valid email domains, since ending in `.edu` is not
proof) and verification provenance on `school_affiliations` (`verification_method`,
`verification_ref`, `reverify_by`). The single `schools.domain` column moved into `school_domains`.
v6 changes: added the **Payments & Dues** domain — `payment_accounts` (per-org rail config),
`dues_cycles`, `charges` (the dues **ledger / source of truth**), `payments`, `payment_methods`
(tokenized, no PAN), `payment_plans` + `installments`, `platform_fees` (our processing-fee
revenue), and `reconciliation_events`. Added a `treasurer` membership role for dues management,
a `member_balances` view, and the payment enums. **Ledger-above-rails model:** every `charge`
routes to one rail — our Stripe Connect rail **or** a mandated Greek platform (OmegaFi /
re:Members) — and only the Stripe rail accrues an application fee.

---

## Enum types

| Enum | Values |
|---|---|
| `org_type` | `fraternity`, `sorority`, `club`, `organization` |
| `account_type` | `student`, `alumni` |
| `affiliation_status` | `current`, `past` |
| `verification_method` | `email_otp`, `sso`, `sheerid`, `document` |
| `membership_role` | `admin`, `treasurer`, `user`, `alumni` |
| `membership_status` | `pending`, `active`, `removed` |
| `invitation_status` | `pending`, `accepted`, `declined`, `expired`, `revoked` |
| `event_visibility` | `org`, `public` |
| `rsvp_status` | `going`, `maybe`, `not_going` |
| `chat_type` | `group`, `dm`, `announcement` |
| `chat_member_role` | `member`, `admin` |
| `post_scope` | `campus`, `chapter` |
| `payment_rail` | `stripe_connect`, `omegafi`, `remembers_choice`, `remembers_unified` |
| `reconcile_mode` | `webhook`, `api_reconcile`, `redirect_only` |
| `payment_account_status` | `pending`, `active`, `restricted` |
| `dues_scope` | `all`, `new_members`, `custom` |
| `charge_category` | `national_dues`, `local_dues`, `social`, `merch`, `event`, `fine` |
| `charge_status` | `unpaid`, `partial`, `paid`, `waived`, `void` |
| `payment_channel` | `card`, `ach`, `apple_pay` |
| `payment_status` | `pending`, `succeeded`, `failed`, `refunded`, `disputed` |
| `reconciliation_source` | `stripe_webhook`, `greek_api`, `manual` |
| `instrument_type` | `card`, `ach` |
| `plan_schedule` | `full`, `monthly`, `custom` |
| `plan_status` | `active`, `completed`, `defaulted` |
| `installment_status` | `scheduled`, `paid`, `late`, `failed` |
| `payout_status` | `pending`, `paid` |

---

## schools
A campus. Anchors campus-feed scope and geo radius.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| name | text | NN | | |
| location | geography(Point,4326) | | | Campus center. |
| radius_m | integer | NN | `8000` | Campus feed radius (meters). |
| created_at | timestamptz | NN | `now()` | |

---

## school_domains
Authoritative list of valid email domains per school. A school often has several
(e.g. `uga.edu`, `mail.uga.edu`), so a signup `.edu` must match a row here for the selected
school — not merely end in `.edu`. **UNIQUE (domain).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| school_id | uuid | FK, NN | | → `schools(id)` ON DELETE CASCADE. |
| domain | citext | UK, NN | | e.g. `uga.edu`. Case-insensitive. |

---

## profiles
One row per user; 1:1 with `auth.users`. Created on signup. **Carries the access tier.**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | | FK → `auth.users(id)` ON DELETE CASCADE. Same UUID as the auth user. |
| username | citext | UK | | Case-insensitive. |
| full_name | text | | | |
| birthday | date | NN | | Required at signup. Surfaced on group calendars via the `member_birthdays` view. |
| account_type | account_type | NN | `'alumni'` | `student` = full access; `alumni` = restricted. Set/upgraded by email verification. |
| edu_verified | boolean | NN | `false` | True once a `.edu` address is confirmed → promote to `student`. |
| school_email | citext | UK | | Current verified `.edu` (matches the current campus's domain); null for alumni/personal-email accounts. |
| avatar_url | text | | | `avatars` storage bucket. |
| phone | text | | | |
| school_id | uuid | FK | | → `schools(id)` ON DELETE SET NULL. **Current** active campus (one at a time); mirrors the `current` row in `school_affiliations`. Drives feed visibility. |
| created_at | timestamptz | NN | `now()` | |
| updated_at | timestamptz | NN | `now()` | Trigger-maintained. |

---

## school_affiliations
Every school a user has been verified at (current + past). Campus is a **property of the person**,
tracked here. **UNIQUE (user_id, school_id)** and **partial UNIQUE (user_id) WHERE status='current'**
(at most one active campus at a time).

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| school_id | uuid | FK, NN | | → `schools(id)` ON DELETE RESTRICT (preserve attendance history). |
| school_email | citext | NN | | The `.edu` used to verify this school. Its domain must match a row in `school_domains` for this `school_id` — not merely end in `.edu` (enforce via trigger / app). |
| status | affiliation_status | NN | `'current'` | `current` (active) or `past` (transferred/graduated). |
| verified_at | timestamptz | | | When the affiliation was confirmed. |
| verification_method | verification_method | | | How it was verified: `email_otp` (baseline), `sso`, `sheerid`, or `document`. |
| verification_ref | text | | | External proof id (e.g. a SheerID verification id); null for plain email OTP. |
| started_at | date | | | Optional enrollment start. |
| ended_at | date | | | Set when flipped to `past`. |
| reverify_by | date | | | Re-verification due date; lapsing rolls the affiliation to `past` (→ alumni). |
| created_at | timestamptz | NN | `now()` | |

---

## organizations
A chapter, club, or student org.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| name | text | NN | | |
| slug | citext | UK | | URL handle. |
| type | org_type | NN | `'organization'` | |
| description | text | | | |
| avatar_url | text | | | |
| primary_color | text | | | Brand accent hex. |
| school_id | uuid | FK | | → `schools(id)` ON DELETE SET NULL. |
| created_by | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| created_at | timestamptz | NN | `now()` | |
| updated_at | timestamptz | NN | `now()` | |

---

## memberships
User ↔ organization link with role + status. **UNIQUE (org_id, user_id).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| org_id | uuid | FK, NN | | → `organizations(id)` ON DELETE CASCADE. |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| role | membership_role | NN | `'user'` | `admin`, `treasurer`, `user`, or `alumni`. See role rules below. |
| status | membership_status | NN | `'pending'` | `pending` = self-request (students/users); `active` after approval or invite-accept. |
| joined_at | timestamptz | NN | `now()` | |

---

## invitations
Invite-only path into an org. Required for alumni (who cannot self-request); also usable
for any admin-initiated invite. **UNIQUE (token).** Accepting an invite creates an `active`
`memberships` row with the invite's `role`.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| org_id | uuid | FK, NN | | → `organizations(id)` ON DELETE CASCADE. |
| email | citext | NN | | Invitee's email (they may not have an account yet). |
| invited_user_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. Resolved if the email matches an account. |
| role | membership_role | NN | `'user'` | Role granted on accept (`alumni` for alumni invites). |
| invited_by | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. Must be an org admin. |
| status | invitation_status | NN | `'pending'` | |
| token | text | UK, NN | | Opaque accept-link token. |
| expires_at | timestamptz | | | Optional expiry. |
| created_at | timestamptz | NN | `now()` | |
| responded_at | timestamptz | | | Set on accept/decline. |

---

## events
An org event. Optional geocoordinate.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| org_id | uuid | FK, NN | | → `organizations(id)` ON DELETE CASCADE. |
| created_by | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| title | text | NN | | |
| description | text | | | |
| location_text | text | | | Human-readable place. |
| location | geography(Point,4326) | | | Optional pin. |
| starts_at | timestamptz | NN | | |
| ends_at | timestamptz | | | CHECK `ends_at IS NULL OR ends_at >= starts_at`. |
| all_day | boolean | NN | `false` | |
| visibility | event_visibility | NN | `'org'` | `public` readable beyond the org. |
| created_at | timestamptz | NN | `now()` | |
| updated_at | timestamptz | NN | `now()` | |

> **View `member_birthdays`** (not a table): joins `memberships` (active) → `profiles.birthday`,
> producing one all-day, annually-recurring birthday entry per active member per org. This is
> how a member's birthday auto-appears on a group's calendar on join and auto-disappears on leave —
> no stored event rows. Suggested columns: `org_id`, `user_id`, `full_name`, `birthday`.

---

## event_rsvps
A member's RSVP. **UNIQUE (event_id, user_id).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| event_id | uuid | FK, NN | | → `events(id)` ON DELETE CASCADE. |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| status | rsvp_status | NN | `'going'` | |
| responded_at | timestamptz | NN | `now()` | |

---

## chats
A conversation. `org_id` nullable for cross-org DMs.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| org_id | uuid | FK | | → `organizations(id)` ON DELETE CASCADE. Null for DMs. |
| type | chat_type | NN | `'group'` | |
| name | text | | | Null for DMs. |
| created_by | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| created_at | timestamptz | NN | `now()` | |
| updated_at | timestamptz | NN | `now()` | |

---

## chat_members
Membership in a chat + read cursor. **UNIQUE (chat_id, user_id).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| chat_id | uuid | FK, NN | | → `chats(id)` ON DELETE CASCADE. |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| role | chat_member_role | NN | `'member'` | |
| last_read_at | timestamptz | NN | `now()` | Compare to `messages.created_at` for unread counts. |
| joined_at | timestamptz | NN | `now()` | |

---

## messages
A single message. Soft-deleted via `deleted_at`.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| chat_id | uuid | FK, NN | | → `chats(id)` ON DELETE CASCADE. |
| sender_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| body | text | | | |
| attachment_url | text | | | `attachments` storage bucket. |
| created_at | timestamptz | NN | `now()` | |
| edited_at | timestamptz | | | |
| deleted_at | timestamptz | | | Soft delete. |

---

## location_settings
Per-user sharing controls. **1:1 with profiles** (PK is the user).

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| user_id | uuid | PK, NN | | FK → `profiles(id)` ON DELETE CASCADE. |
| sharing_enabled | boolean | NN | `true` | Master switch. |
| ghost_mode | boolean | NN | `false` | Temporarily hide live location. |
| updated_at | timestamptz | NN | `now()` | |

---

## locations
Append-only ping history. Latest-per-user via the `latest_locations` view.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| point | geography(Point,4326) | NN | | GiST index recommended. |
| accuracy_m | real | | | |
| battery_level | smallint | | | |
| place_label | text | | | e.g. "Library". |
| captured_at | timestamptz | NN | `now()` | Device time of fix. |
| created_at | timestamptz | NN | `now()` | Server insert time. |

> **View `latest_locations`**: `DISTINCT ON (user_id) ... ORDER BY user_id, captured_at DESC`.

---

## posts
Anonymous post, scoped to a campus **or** a chapter. CHECK enforces the matching FK.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| scope | post_scope | NN | `'campus'` | |
| school_id | uuid | FK | | → `schools(id)` ON DELETE CASCADE. Required when `scope='campus'`. |
| org_id | uuid | FK | | → `organizations(id)` ON DELETE CASCADE. Required when `scope='chapter'`. |
| author_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. For moderation; hidden in UI. |
| is_anonymous | boolean | NN | `true` | |
| body | text | NN | | |
| point | geography(Point,4326) | | | |
| score | integer | NN | `0` | Denormalized vote sum (maintain via trigger). |
| created_at | timestamptz | NN | `now()` | |
| deleted_at | timestamptz | | | Soft delete. |

> CHECK: `(scope='campus' AND school_id IS NOT NULL) OR (scope='chapter' AND org_id IS NOT NULL)`.

---

## post_votes
One vote per user per post. **UNIQUE (post_id, user_id).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| post_id | uuid | FK, NN | | → `posts(id)` ON DELETE CASCADE. |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| value | smallint | NN | | CHECK `value IN (-1, 1)`. |
| created_at | timestamptz | NN | `now()` | |

---

## comments
A reply on a post.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| post_id | uuid | FK, NN | | → `posts(id)` ON DELETE CASCADE. |
| author_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| body | text | NN | | |
| score | integer | NN | `0` | Denormalized vote sum. |
| created_at | timestamptz | NN | `now()` | |
| deleted_at | timestamptz | | | Soft delete. |

---

## comment_votes
One vote per user per comment. **UNIQUE (comment_id, user_id).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| comment_id | uuid | FK, NN | | → `comments(id)` ON DELETE CASCADE. |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| value | smallint | NN | | CHECK `value IN (-1, 1)`. |
| created_at | timestamptz | NN | `now()` | |

---
---

# Payments & Dues (v6)

**Ledger-above-rails.** `charges` is the source of truth (who owes what, what's paid). It sits
above two payment *rails*: our own **Stripe Connect** rail (`payment_rail = 'stripe_connect'`,
which we process and which accrues our application fee) and a chapter's **mandated Greek platform**
(OmegaFi / re:Members — `omegafi`, `remembers_choice`, `remembers_unified`, which we redirect to
and reconcile, never process). Routing is **per line item** via `charges.payment_account_id`, so
national dues can flow to a mandated Greek rail while local dues flow to Stripe — on one roster.
We never hold funds or store card numbers; Stripe is the regulated entity on our rail.

---

## payment_accounts
A chapter's connection to one payment rail. An org may have several (e.g. our Stripe rail for
local dues **and** a mandated Greek platform for national dues). **UNIQUE (org_id, rail).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| org_id | uuid | FK, NN | | → `organizations(id)` ON DELETE CASCADE. |
| rail | payment_rail | NN | | `stripe_connect` = our processed rail; others = redirect + reconcile only. |
| external_ref | text | | | Stripe connected-account id, or Greek-platform partner/account id. |
| reconcile_mode | reconcile_mode | NN | `'webhook'` | How paid-status returns: `webhook` (Stripe), `api_reconcile` (Greek API), `redirect_only` (no API → manual). |
| status | payment_account_status | NN | `'pending'` | Stripe onboarding/KYC state, or Greek-link health. |
| is_mandated | boolean | NN | `false` | True when national HQ requires this rail; `national_dues` charges route here. |
| is_active | boolean | NN | `true` | |
| created_at | timestamptz | NN | `now()` | |
| updated_at | timestamptz | NN | `now()` | |

---

## dues_cycles
A billing run an org issues to some/all members — the batch that generates `charges`.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| org_id | uuid | FK, NN | | → `organizations(id)` ON DELETE CASCADE. |
| created_by | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. Must be an `admin` or `treasurer`. |
| name | text | NN | | e.g. "Fall 2026 Dues". |
| scope | dues_scope | NN | `'all'` | Who gets billed: `all` active members, `new_members`, or a `custom` set. |
| default_amount_cents | integer | | | Per-member amount used to generate charges. CHECK `>= 0`. |
| due_date | date | | | Default due date applied to generated charges. |
| created_at | timestamptz | NN | `now()` | |

---

## charges
**The dues ledger — source of truth.** One line item a member owes. Routes to a rail per line
item via `payment_account_id`. A member may have many charges per cycle (dues + a fine + merch),
so no per-cycle uniqueness.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| org_id | uuid | FK, NN | | → `organizations(id)` ON DELETE CASCADE. |
| user_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. The member who owes; null preserves the ledger row if the member is deleted. |
| dues_cycle_id | uuid | FK | | → `dues_cycles(id)` ON DELETE SET NULL. Null for ad-hoc charges (one-off fine, merch). |
| payment_account_id | uuid | FK, NN | | → `payment_accounts(id)` ON DELETE RESTRICT. The rail this line routes to (must share `org_id`). |
| category | charge_category | NN | | `national_dues` → mandated rail; everything else → Stripe rail. |
| description | text | | | |
| amount_cents | integer | NN | | CHECK `amount_cents >= 0`. |
| due_date | date | | | |
| status | charge_status | NN | `'unpaid'` | Driven by `payments` (`partial`/`paid`) and treasurer actions (`waived`/`void`). |
| created_at | timestamptz | NN | `now()` | |

> **View `member_balances`** (not a table): per org per member, sums `unpaid` + `partial`
> `charges` into an outstanding balance for the treasurer's "who still owes" dashboard.
> Suggested columns: `org_id`, `user_id`, `full_name`, `outstanding_cents`, `oldest_due_date`.

---

## payments
An actual money movement against a charge (an attempt/settlement on a rail). A charge can have
several (retries, partials).

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| charge_id | uuid | FK, NN | | → `charges(id)` ON DELETE CASCADE. |
| user_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. Payer. |
| payment_account_id | uuid | FK, NN | | → `payment_accounts(id)` ON DELETE RESTRICT. Rail the money moved on. |
| channel | payment_channel | NN | | `card`, `ach`, `apple_pay` (no P2P apps). |
| gross_cents | integer | NN | | What the member paid. CHECK `>= 0`. |
| processor_fee_cents | integer | NN | `0` | Stripe / Greek processor fee. |
| application_fee_cents | integer | NN | `0` | **Our cut. Non-zero only on the `stripe_connect` rail.** |
| net_cents | integer | NN | | To the chapter. CHECK `net_cents = gross_cents - processor_fee_cents - application_fee_cents`. |
| external_ref | text | | | Stripe PaymentIntent id / Greek txn id. |
| status | payment_status | NN | `'pending'` | |
| reconciliation_source | reconciliation_source | | | How status was confirmed. |
| paid_at | timestamptz | | | Set when `status = succeeded`. |
| created_at | timestamptz | NN | `now()` | |

---

## payment_methods
A member's saved, tokenized instrument for autopay. **Stores a processor token + `last4` only —
never a card number (keeps us in the lightest PCI tier).** **Partial UNIQUE (user_id,
payment_account_id) WHERE is_default** (at most one default per rail account).

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| user_id | uuid | FK, NN | | → `profiles(id)` ON DELETE CASCADE. |
| payment_account_id | uuid | FK, NN | | → `payment_accounts(id)` ON DELETE CASCADE. Tokens are rail-specific (Stripe). |
| processor_token | text | NN | | Stripe `payment_method` id. **Never a PAN.** |
| type | instrument_type | NN | | `card` or `ach`. |
| brand | text | | | e.g. `visa`. Display only. |
| last4 | text | | | Display only. |
| is_default | boolean | NN | `false` | |
| autopay_enabled | boolean | NN | `false` | |
| created_at | timestamptz | NN | `now()` | |

---

## payment_plans
Splits a charge into installments / autopay.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| charge_id | uuid | FK, NN | | → `charges(id)` ON DELETE CASCADE. |
| user_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. |
| schedule | plan_schedule | NN | `'full'` | |
| installments_total | integer | NN | `1` | CHECK `installments_total >= 1`. |
| status | plan_status | NN | `'active'` | |
| created_at | timestamptz | NN | `now()` | |

---

## installments
One scheduled slice of a `payment_plan`. **UNIQUE (plan_id, seq_no).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| plan_id | uuid | FK, NN | | → `payment_plans(id)` ON DELETE CASCADE. |
| payment_id | uuid | FK | | → `payments(id)` ON DELETE SET NULL. Set when this slice is paid. |
| seq_no | integer | NN | | 1-based order within the plan. |
| amount_cents | integer | NN | | CHECK `amount_cents >= 0`. |
| due_date | date | NN | | |
| status | installment_status | NN | `'scheduled'` | |

---

## platform_fees
Our processing-fee revenue ledger. **One row per `stripe_connect` payment** (Greek-rail payments
earn nothing). Derived from `payments.application_fee_cents`. **UNIQUE (payment_id).**

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| payment_id | uuid | FK, UK, NN | | → `payments(id)` ON DELETE CASCADE. |
| application_fee_cents | integer | NN | | What we charged on top. |
| connect_cost_cents | integer | NN | `0` | Stripe Connect platform cost on the payment. |
| net_revenue_cents | integer | NN | | CHECK `net_revenue_cents = application_fee_cents - connect_cost_cents`. |
| period | text | | | Payout-period bucket, e.g. `2026-09`. |
| payout_status | payout_status | NN | `'pending'` | |
| created_at | timestamptz | NN | `now()` | |

---

## reconciliation_events
Append-only audit of how a payment reached its status — a Stripe webhook, a Greek-platform API
sync, or a treasurer marking it manually. Keeps the unified "who's paid" board trustworthy across
both rails.

| Field | Datatype | Key / NN | Default | Notes |
|---|---|---|---|---|
| id | uuid | PK, NN | `gen_random_uuid()` | |
| payment_id | uuid | FK, NN | | → `payments(id)` ON DELETE CASCADE. |
| source | reconciliation_source | NN | | `stripe_webhook`, `greek_api`, or `manual`. |
| actor_id | uuid | FK | | → `profiles(id)` ON DELETE SET NULL. Set only when `source = manual` (the treasurer). |
| external_ref | text | | | Webhook event id / Greek API record id. |
| occurred_at | timestamptz | NN | `now()` | |

---

## Relationships (quick reference)

| Parent | Child | FK column | On delete |
|---|---|---|---|
| schools | profiles | school_id | SET NULL |
| schools | organizations | school_id | SET NULL |
| schools | posts | school_id | CASCADE |
| schools | school_domains | school_id | CASCADE |
| auth.users | profiles | id | CASCADE |
| schools | school_affiliations | school_id | RESTRICT |
| profiles | school_affiliations | user_id | CASCADE |
| profiles | memberships | user_id | CASCADE |
| organizations | memberships | org_id | CASCADE |
| organizations | invitations | org_id | CASCADE |
| profiles | invitations | invited_user_id | SET NULL |
| profiles | invitations | invited_by | SET NULL |
| organizations | events | org_id | CASCADE |
| profiles | events | created_by | SET NULL |
| events | event_rsvps | event_id | CASCADE |
| profiles | event_rsvps | user_id | CASCADE |
| organizations | chats | org_id | CASCADE |
| chats | chat_members | chat_id | CASCADE |
| profiles | chat_members | user_id | CASCADE |
| chats | messages | chat_id | CASCADE |
| profiles | messages | sender_id | SET NULL |
| profiles | location_settings | user_id | CASCADE |
| profiles | locations | user_id | CASCADE |
| organizations | posts | org_id | CASCADE |
| profiles | posts | author_id | SET NULL |
| posts | post_votes | post_id | CASCADE |
| profiles | post_votes | user_id | CASCADE |
| posts | comments | post_id | CASCADE |
| profiles | comments | author_id | SET NULL |
| comments | comment_votes | comment_id | CASCADE |
| profiles | comment_votes | user_id | CASCADE |
| organizations | payment_accounts | org_id | CASCADE |
| organizations | dues_cycles | org_id | CASCADE |
| profiles | dues_cycles | created_by | SET NULL |
| organizations | charges | org_id | CASCADE |
| profiles | charges | user_id | SET NULL |
| dues_cycles | charges | dues_cycle_id | SET NULL |
| payment_accounts | charges | payment_account_id | RESTRICT |
| charges | payments | charge_id | CASCADE |
| profiles | payments | user_id | SET NULL |
| payment_accounts | payments | payment_account_id | RESTRICT |
| profiles | payment_methods | user_id | CASCADE |
| payment_accounts | payment_methods | payment_account_id | CASCADE |
| charges | payment_plans | charge_id | CASCADE |
| profiles | payment_plans | user_id | SET NULL |
| payment_plans | installments | plan_id | CASCADE |
| payments | installments | payment_id | SET NULL |
| payments | platform_fees | payment_id | CASCADE |
| payments | reconciliation_events | payment_id | CASCADE |
| profiles | reconciliation_events | actor_id | SET NULL |

---

## Access & role rules to enforce (logic, not columns)

These live in RLS policies / app logic when you build the schema — the fields above are
just the switches they read.

**Campus affiliation (property of the person)**
- Verifying a school requires a `.edu` whose domain matches a row in `school_domains` for that school — not merely ending in `.edu`. Baseline = email OTP (prove inbox control) + domain match; stronger = SSO or a provider like SheerID, recorded in `verification_method` / `verification_ref`. A successful verification inserts a `school_affiliations` row with `status='current'` and sets `profiles.school_id` and `profiles.school_email`.
- Exactly one `current` affiliation per user (partial unique). To transfer/graduate: flip the existing `current` row to `past` (set `ended_at`), then add a new `current` row verified with the new campus's `.edu`.
- Past schools remain in `school_affiliations` as history.
- Enrollment lapses over time: `reverify_by` drives periodic re-verification; when it passes without re-verification, flip the row to `past` (the user becomes alumni).

**Account tier (email gating)**
- Has a `current` affiliation (a verified `.edu`) → `account_type = 'student'`, `edu_verified = true` → full access (Map, Feed, Messaging, Calendar).
- No `current` affiliation (graduated, or personal-email signup that never verified a `.edu`) → `account_type = 'alumni'` → restricted to **Messaging (chats/messages) + Calendar (events/event_rsvps + birthdays)** only. Block reads/writes on `posts`, `post_votes`, `comments`, `comment_votes`, `locations`. (See **Alumni & payments** below for the one carve-out.)

**Joining a group**
- Students/users may self-request: insert a `memberships` row with `status='pending'` for themselves; an admin approves to `active`.
- Alumni may NOT self-request — block the self-insert path when `account_type='alumni'`. They can only join by accepting an `invitations` row, which creates an `active` membership with the invite's `role`.
- Only org admins may create `invitations` (`invited_by` must be an admin of `org_id`).

**Org membership roles** (`admin` / `treasurer` / `user` / `alumni`)
- Admins can promote others to `admin` (role-change allowed only when the actor is an org admin).
- A regular `user` cannot promote itself — reject any self-update where `user_id = auth.uid()` and new `role = 'admin'`.
- An `alumni` cannot be an org admin — forbid `role = 'admin'` when the member's `account_type = 'alumni'` (CHECK via trigger, or enforce in the policy's `WITH CHECK`).
- A `treasurer` may manage the Payments & Dues domain (below) but is **not** a full admin: it cannot create invitations, approve memberships, or change roles. Only `admin` may grant the `treasurer` role.

**Dues management (who can bill)** — *new in v6*
- Creating/editing `payment_accounts`, `dues_cycles`, and `charges`, waiving/voiding charges, and manual reconciliation are limited to org `admin` or `treasurer`. A `user`/`alumni` may only **read and pay their own** charges (`charges`/`payments WHERE user_id = auth.uid()`).
- A `charge.payment_account_id` must belong to the same `org_id`. `category = 'national_dues'` routes to the org's mandated account (`payment_accounts.is_mandated = true`); other categories route to the org's `stripe_connect` account. Enforce in app/trigger.
- `payments.application_fee_cents > 0` is allowed **only** when the payment's `payment_account.rail = 'stripe_connect'`. Greek-rail payments carry a zero application fee (we never touch the funds).
- `charges.status` is system-maintained from `payments` (sum of `succeeded` net vs `amount_cents` → `partial`/`paid`); only `admin`/`treasurer` may set `waived`/`void` directly.

**Payments & PCI**
- We never store card numbers. `payment_methods.processor_token` holds a Stripe token; only `brand`/`last4` are shown. This keeps the app in the lightest PCI tier and off the money-transmitter hook — Stripe is the regulated entity on our rail.
- On a Greek rail we redirect the payer to the provider's hosted page (no card data touches us) and only read paid-status back, recorded in `reconciliation_events` (`source = greek_api` or `manual`).

**Alumni & payments** (carve-out to the v5 alumni restriction)
- The v5 access matrix restricts alumni to Messaging + Calendar, but payments cut across that: an alumnus who owes (alumni dues, house rent) needs read + pay on their **own** charges. Encode an exception that allows `select`/pay on `charges`/`payments WHERE user_id = auth.uid()` regardless of tier, while keeping every other alumni restriction intact.

**Birthdays on the calendar**
- Birthday entries are derived, not stored: the `member_birthdays` view exposes each active member's `birthday` per org, so it appears on join and disappears on leave automatically. No trigger or event rows required.
