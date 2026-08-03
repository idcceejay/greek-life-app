# Launch Plan & Monetization Strategy

**Product:** Rally — all-in-one app for Greek life & campus orgs
**Team:** Cooper Parrish, Ceejay Raut
**Plan date:** 07/08/2026 · **Launch target unchanged: 08/31/2026**

---

## 1. Where we are vs. the original Gantt

The original schedule (`Gannt-Chart.md`) had us finishing the calendar engine the week of
07/13. As of 07/08 the repo had planning docs but no application code, so this plan
re-baselines Phase 2 while holding the 08/31 launch date. What changed in our favor:
the schema (v7), RLS policies, and the full navigation shell + all five screens (Home,
Map, Chats, Calendar, Feed) now exist in this repo, which claws back roughly three weeks
of the slip in one step.

### Re-baselined schedule (07/08 → 08/31)

| # | Milestone | Start | End | Exit criteria |
|---|---|---|---|---|
| 1 | **Supabase project live** — apply migrations 0001–0003, seed school + domains, enable email OTP auth | 07/08 | 07/12 | Sign-up with .edu OTP creates profile + affiliation |
| 2 | **Auth flows in app** — sign-in screen, session persistence, student/alumni gating | 07/10 | 07/17 | Fresh install → verified session → tabs |
| 3 | **Calendar engine** — live events CRUD, RSVP, week/month views, birthdays view, RRULE expansion, ICS export feed | 07/13 | 07/24 | Org calendar round-trips; feed subscribes in Apple Calendar |
| 4 | **Realtime chat** — chats/messages over Supabase Realtime, unread counts, push via Expo Notifications | 07/20 | 07/31 | Two devices converse < 1 s latency; push received in background |
| 5 | **Feed + moderation** — anonymous posts, votes, comments, report/block flows (App Review requirement) | 07/27 | 08/07 | Report → content hidden pending review |
| 6 | **Live map** — react-native-maps, location pings, latest_locations, ghost mode | 08/03 | 08/12 | Opt-in sharing visible to chapter only |
| 7 | **Media** — avatars + chat attachments via Supabase Storage buckets | 08/05 | 08/12 | Upload/download with signed URLs |
| 8 | **TestFlight** — EAS Build, App Store Connect setup, internal build | 08/10 | 08/14 | Build on 10 internal devices |
| 9 | **Closed beta** — one pilot chapter (~30–60 members), crash + feedback loop | 08/14 | 08/26 | ≥60% WAU in pilot; crash-free > 99% |
| 10 | **Launch readiness** — App Review submission (buffer for rejection), pitch deck, campus launch plan | 08/24 | 08/31 | App approved; launch-day checklist done |
| — | *Post-launch (Sept+)* — **Dues & payments** (Stripe Connect rail, schema already shipped in v7) | 09/01 | 10/15 | First real dues cycle collected |

**Deliberate call:** payments ship *after* launch. The schema/ledger is done (v7), but
Stripe Connect onboarding, KYC, and App Review financial scrutiny would put 08/31 at risk,
and the free feature set (calendar + chat + map + feed) is what drives adoption anyway.
Dues monetization needs chapters already living in the app — sequence it second.

### Critical path & risks

| Risk | Odds | Mitigation |
|---|---|---|
| App Review rejection over anonymous feed (Guideline 1.2) | High if unmitigated | Report/block/moderation shipped in v7 schema + milestone 5; submit 08/24 leaving a full re-review buffer |
| Apple Developer enrollment delay | Medium | Enroll the org account **this week** (D-U-N-S can take 2+ weeks) |
| Two-person team, summer schedules | Medium | Milestones 3–7 are independently shippable; cut order if squeezed: media → map → feed |
| Location privacy blowback | Medium | Opt-in only, ghost mode, 90-day purge (already in RLS/migrations), plain-language privacy policy |

---

## 2. Go-to-market

**Beachhead:** one campus, 3–5 chapters, fall rush 2026. Greek orgs are dense social
graphs — one chapter adopting pulls in every member (network effect per org, not per user).

1. **Pilot (Aug):** your own chapter + closest allies. Free forever for pilot chapters.
   Success metric: weekly active ≥ 60% of roster during rush.
2. **Campus rollout (Sept–Oct):** Panhellenic/IFC council intro, exec-board demos.
   The wedge is the **calendar + announcement chat during rush week** — the highest-pain
   two weeks of the Greek year.
3. **Second campus (spring 2027):** founder-led sales to 2–3 chapters at a nearby school;
   validates the playbook before any paid growth.

**Positioning:** "GroupMe + Google Calendar + Life360 + Yik Yak in one app, built for
chapters." Incumbents are single-feature (GroupMe: chat only) or admin-first billing tools
students hate (OmegaFi, GreekBill — custom-priced, treasurer-facing, no daily utility).
We're member-first: daily-use social tools with treasurer tools attached.

---

## 3. Monetization

Three layers, sequenced so free growth is never taxed:

### Layer 1 — Payments take-rate (primary, ships Sept–Oct 2026)
The v7 schema's ledger-above-rails model is the moat: chapters keep OmegaFi/re:Members for
mandated national dues while running *local* dues, fines, merch, and event fees through our
**Stripe Connect** rail. We charge an **application fee of ~2% + $0.30 on top of Stripe's
processing** on our rail only (`platform_fees` table already models net revenue).
A 60-member chapter moving $250/member/semester locally ≈ $30k/yr → **~$600/yr per chapter**
at 2%, with zero per-seat sales friction. Payment plans/installments (also in schema)
justify the fee to members.

### Layer 2 — Chapter Pro subscription (SaaS, spring 2027)
Free tier: calendar, chat, map, feed, roster — everything social, forever free (that's the
growth engine). **Chapter Pro ~$25–50/month per chapter** (or ~$1/member/month) adds
treasurer dashboard (member_balances), dues cycles + autopay, attendance/RSVP exports,
announcement blasts, alumni management, custom branding. Sold to exec boards, priced under
a single social's budget; anchor against OmegaFi-style tools that run far higher.

### Layer 3 — Campus & network revenue (2027+)
- **Local sponsorships in the campus feed** (clearly labeled): bars, late-night food,
  rideshare promos targeting verified students — CPM-priced, one slot per session.
- **Nationals/HQ dashboards**: chapter-health analytics across a fraternity's chapters
  (engagement, dues collection rates) as an enterprise SKU.
- **Rush tools**: PNM (potential new member) pipelines during recruitment windows.

### What we deliberately do NOT do
No selling location data (kills trust permanently), no per-member fees on the free tier,
no ads inside chapter (private) spaces — ads only in the public campus feed.

### Revenue model sketch (per campus at maturity)
| Stream | Assumption | Annual |
|---|---|---|
| Payments take-rate | 15 chapters × $30k local volume × 2% | $9,000 |
| Chapter Pro | 10 chapters × $40/mo | $4,800 |
| Feed sponsorships | 2 sponsors × $250/mo × 9 school months | $4,500 |
| **Total / campus** | | **~$18k** |

Ramen-profitable at ~5 campuses; the model compounds because payments volume and Pro
attach deepen with tenure while CAC ≈ 0 inside a campus (chapter-level virality).

---

## 4. Company & compliance checklist

- [ ] Form an LLC (or Delaware C-corp if raising) before collecting any payment volume
- [ ] Apple Developer Program (organization) — start now, needs D-U-N-S
- [ ] Privacy policy + ToS: location, anonymous posting, FERPA-adjacent claims reviewed
- [ ] Stripe Connect platform application (Standard connected accounts = lightest compliance; Stripe is the regulated entity, we never hold funds — matches v7 §payments)
- [ ] Moderation policy + response SLA for reports (App Review will ask)
- [ ] University trademark caution: don't use school marks in app assets
- [ ] Data retention: 90-day location purge (shipped), account deletion flow (App Store requirement)

---

## 5. KPIs

| Phase | Metric | Target |
|---|---|---|
| Beta (Aug) | WAU / roster | ≥ 60% |
| Beta (Aug) | Crash-free sessions | ≥ 99% |
| Launch (Sept) | Chapters onboarded | 5 |
| Fall | D30 retention | ≥ 40% |
| Fall | Messages / member / week | ≥ 15 |
| Winter | Local dues volume on-platform | $100k annualized |
