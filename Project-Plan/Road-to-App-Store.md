# Rally — road to the App Store — remaining work & team split

**Team:** Ceejay · Cooper · TJ
**Written:** 07/29/2026 · **Original target:** 08/31/2026

---

## 1. Timeline reality check

Today is ~4.5 weeks from 08/31. What's built is real (auth, orgs, calendar, realtime chat
with invites, feed, map, check-in), but four things stand between here and a *public*
App Store release, and two of them are outside our control:

| Gate | Time cost | Controllable? |
|---|---|---|
| Apple Developer Program enrollment (D-U-N-S for an org account) | 1–3 weeks | ❌ waiting on Apple/D&B |
| Moderation features required by Guideline 1.2 (anonymous feed) | ~1 week of work | ✅ |
| Account deletion required by Guideline 5.1.1(v) | ~2 days | ✅ |
| App Review itself (+ one rejection cycle) | 3–10 days | ❌ |

**Recommended plan:** hold 08/31 as the **TestFlight beta with our own chapter during
rush** — that's the date that actually matters for adoption — and target **mid-to-late
September** for the public App Store release. Trying to hit public launch on 08/31 means
submitting around 08/20, which leaves no room for a single rejection.

Everything below is ordered so that a public launch stays possible if enrollment moves fast.

---

## 2. The three workstreams

Split by layer, so two people rarely edit the same file.

### Ceejay — Product, accounts, launch (owner)
You hold everything that isn't code but blocks shipping.

- **Apple Developer Program enrollment — start today.** Organization account needs a D-U-N-S
  number (free, but 1–2 weeks). If the LLC isn't formed, enroll as an individual now and
  migrate later; do not let this sit.
- Form the LLC before any payments work (post-launch, but the clock starts here).
- Privacy Policy + Terms of Service, hosted at a public URL (App Review requires the link).
  Must cover: location sharing, anonymous posting, .edu verification, data retention.
- App Store listing: name, subtitle, description, keywords, category, age rating
  (anonymous UGC ⇒ expect 17+), support URL, marketing screenshots.
- Privacy "nutrition labels" in App Store Connect (location, contact info, user content).
- **Moderation policy + response SLA** (Apple asks for the plan, not just the buttons):
  who reviews reports, within how long (24h is the standard commitment), what gets removed.
- Recruit and manage the pilot: 30–60 members, feedback channel, bug intake.
- Design QA: walk every screen on a real phone, log what looks wrong.

### Cooper — Backend, database, security
You own everything behind `supabase/` and the security posture.

- **RLS audit + test suite.** Every policy was written but never adversarially tested. Write
  a script that signs in as (a) a student in org A, (b) a student in org B, (c) an alumnus,
  (d) a suspended user, and asserts each can/can't read the other's posts, messages,
  locations, charges. This is the single highest-value security task.
- Turn on the **90-day location purge** (`pg_cron` job is written but commented out in
  `0003_rls.sql`).
- Move email off personal Gmail SMTP → **Resend** (or Postmark) with a real sending domain.
  Gmail caps ~500/day and will land in spam at scale.
- Supabase hardening: Auth rate limits (OTP requests/hour), Attack Protection on, review the
  dashboard's Security Advisor warnings, confirm `service_role` key exists nowhere in the app,
  upgrade off free tier before real users (free = no backups, project pauses when idle).
- Push notifications backend: Edge Function that reads `notifications` and fans out to Expo
  push tokens in `devices` (tables already exist).
- Storage buckets + policies for avatars and chat attachments (not created yet).
- Account deletion RPC (hard delete of profile + cascade, called by the app).
- Keep migrations sequential (`0007_…`) and validated before they're applied.

### TJ — Mobile app screens
You own everything under `app/` and `components/`.

- **Member management** (biggest gap): roster screen, approve/decline pending join requests,
  promote to admin/treasurer, remove member. `memberships` and RLS already support it; there's
  no UI at all.
- **Moderation UI** (blocks App Review): report button on posts/comments/messages, block user,
  "blocked users" list in settings, and an in-app EULA acceptance for the feed.
- **Settings/profile screen**: edit name/username/avatar, notification prefs, ghost mode,
  **Delete account** (Apple requires this in-app), sign out (currently hidden behind the
  Home avatar).
- RSVP buttons on events (`event_rsvps` exists, unused) + "who's going" list.
- Event editing (create/delete exist; edit doesn't).
- Empty/loading/error states everywhere — right now failures are mostly silent.
- Deep links so an invite code opens the app instead of being pasted manually.

---

## 3. Week-by-week

| Week | Ceejay | Cooper | TJ |
|---|---|---|---|
| **Jul 29 – Aug 4** | Apple enrollment submitted; privacy policy + ToS drafted | RLS test suite; location purge on; Resend SMTP | Member management screen (roster + approvals) |
| **Aug 5 – 11** | App Store listing copy + screenshots; moderation policy written | Storage buckets; account-deletion RPC; rate limits | Moderation UI (report/block/EULA) |
| **Aug 12 – 18** | Pilot recruiting; test scripts for members | Push notification Edge Function | Settings/profile + delete account; RSVP |
| **Aug 19 – 25** | **EAS dev build → TestFlight**; onboard 30–60 testers | Monitor logs, fix data bugs from real usage | Bug fixes from beta feedback; polish pass |
| **Aug 26 – Sep 1** | Beta running through rush; collect crash/feedback data | Backups, tier upgrade, load sanity check | Real Apple Maps verification in the dev build |
| **Sep 2 – 15** | Submit to App Review; handle rejection cycle | Support fixes | Support fixes |

---

## 4. Blocking checklist for App Review

Nothing ships without every box ticked.

- [ ] Apple Developer Program active
- [ ] Report content (posts, comments, messages) — Guideline 1.2
- [ ] Block user — Guideline 1.2
- [ ] Published support contact + moderation plan with a 24h response commitment — Guideline 1.2
- [ ] Delete account in-app, permanent (not deactivate) — Guideline 5.1.1(v)
- [ ] Privacy Policy URL live
- [ ] Privacy nutrition labels filled in App Store Connect
- [ ] Location permission strings explain *why* ("see chapter members who choose to share")
- [ ] Age rating set
- [ ] No demo/mock data reachable in the shipped build
- [ ] App icon + screenshots
- [ ] Crash-free rate ≥ 99% in TestFlight

---

## 5. Security checklist

- [ ] RLS adversarial test suite passes (cross-org, alumni tier, suspended users)
- [ ] `service_role` key never in the client bundle (only `EXPO_PUBLIC_*` anon key)
- [ ] `.env` stays out of git (already in `.gitignore` — keep it that way)
- [ ] Auth rate limits + Attack Protection enabled
- [ ] Supabase Security Advisor: zero unresolved warnings
- [ ] 90-day location purge job running
- [ ] Location sharing is opt-in, ghost mode works, no background tracking
- [ ] Storage buckets are private with signed URLs (not public)
- [ ] Paid Supabase tier before real users → daily backups, no idle pausing
- [ ] Invite tokens expire (30 days — done) and are revocable
- [ ] No PANs stored anywhere; Stripe holds card data when payments ship

---

## 6. Known bugs / polish backlog

1. Real Apple Maps only renders in a dev build (Expo Go shows the styled fallback) — verify
   in TestFlight.
2. No RSVP UI; `chat_unread_counts` view is unused (no unread badges on real data).
3. Errors surface as bare Postgres strings in places — needs friendly copy.
4. No avatars anywhere (initials only) until storage buckets exist.
5. Timezone handling assumes device local time; test across DST.
6. Event edit missing; recurring events only support yearly.
7. No pagination — feed and messages load a fixed window.

---

## 7. Working agreements (so three people don't break each other)

- **Branches:** work on `feature/<name>`, PR into `main`. Never commit straight to `main`.
- **Never run `npm update` or `npm audit fix --force`** — it breaks the SDK 54 pin and the
  app stops loading in Expo Go. To change a package: `npx expo install <pkg> --fix`.
- **Migrations are append-only and sequential** (`0007_…`, `0008_…`). Never edit an applied
  migration; write a new one. Validate before applying.
- **RLS blocking a two-step client operation ⇒ write a `SECURITY DEFINER` RPC** (see
  `create_organization`, `create_group_chat` for the pattern).
- **All modal forms use `components/Sheet.tsx`**, not React Native's `Modal animationType`.
- `CLAUDE.md` is the shared source of truth — update it when architecture changes.
- Daily 10-minute standup during August; one shared bug list (GitHub Issues).
