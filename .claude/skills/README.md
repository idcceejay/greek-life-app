# Rally skill bundle

21 skills selected from [ECC](https://github.com/affaan-m/ecc) (284 total, MIT licensed).
Chosen against Rally's real stack: Expo SDK 54 - React Native 0.81.5 - React 19.1.0 -
TypeScript - Expo Router - Supabase (Postgres + PostGIS + RLS) - Stripe Connect edge
functions - launch target 08/31/2026.

## What these are

Instruction files, not code. Nothing here ships to users and nothing touches
`package.json`. When you ask Claude Code to do something in this repo, it reads the
matching skill first and follows those patterns instead of improvising.

They load automatically - no command to run. `.claude/skills/` is the project-scoped
location, so Cooper gets the identical set when he pulls.

## The 21, and why each one is here

### Stack - matches what Rally actually is

| Skill | Fires when | Why for Rally |
|---|---|---|
| `react-native-patterns` | Expo Router work, screens, navigation | The single most on-target skill. Expo Router file routing, server/client/route/form state separation, permissions. |
| `react-patterns` | Any component work | React 19 hooks discipline. You're on 19.1.0 exactly. |
| `react-performance` | Lists, maps, re-render problems | The live member map and campus feed are your two render-heavy screens. |
| `postgres-patterns` | Schema, queries, indexes | Explicitly written on Supabase best practices. |
| `database-migrations` | Adding to `supabase/migrations/` | You're at 0008 and applying by hand through the dashboard. Covers rollback and zero-downtime ordering. |
| `error-handling` | Anywhere | Typed errors, boundaries, retries. The app has almost none today - a network blip on the map or dues screen currently surfaces raw. |

### Security - the part that actually matters here

| Skill | Fires when | Why for Rally |
|---|---|---|
| `security-review` | Auth, user input, secrets, API endpoints, payment features | Its trigger list reads like a description of Rally. Your main payment-safety coverage. |
| `security-bounty-hunter` | Pre-launch sweeps | Hunts remotely-reachable holes. Point it at your RLS policies and the three edge functions before submission. |
| `security-scan` | Auditing `.claude/` itself | This is AgentShield. Scans your *agent config* for injection risks and leaked secrets - not your app. Different job from the two above. |
| `safety-guard` | Destructive ops on live systems | You run migrations against the live Supabase project. This is the guardrail against a bad `DROP` on real chapter data. |

### Testing and verification - your biggest gap

The repo has **zero tests, no linter, no formatter, and no CI.** These four address that.

| Skill | Fires when | Why for Rally |
|---|---|---|
| `tdd-workflow` | New features, bug fixes | Enforces tests-first at 80% coverage. See the caveat below. |
| `react-testing` | Component tests | RTL + Vitest/Jest, MSW for mocking Supabase calls. |
| `verification-loop` | End of a task | Structured "did this actually work" pass. |
| `delivery-gate` | Claude tries to finish | Blocks completion until checks pass; detects rationalizing language like "should work now." Valuable when you can't easily read the code yourself to tell. |

### Launch - 08/31 is close

| Skill | Fires when | Why for Rally |
|---|---|---|
| `production-audit` | Pre-launch review | Literally "what breaks in prod?" Run this before submission. |
| `deployment-patterns` | EAS builds, CI, rollback | You have `eas.json` and no pipeline yet. |
| `accessibility` | UI work | WCAG 2.2 AA. App Store review does check this, and RN needs explicit a11y props. |
| `git-workflow` | Branching, commits | Two-person team. You just had 40 files sitting uncommitted. |

### Design - Apple HIG + bento grid

| Skill | Fires when | Why for Rally |
|---|---|---|
| `design-system` | Styling, visual consistency | You already have tokens in `lib/theme.ts`; this audits drift. |
| `make-interfaces-feel-better` | Polish passes | Spacing, type, shadows, borders. The gap between "works" and "feels Apple." |
| `documentation-lookup` | Setup and API questions | Pulls live docs via Context7 instead of training data. **High value given the SDK 54 pin** - models default to newer Expo APIs that will break your build. |

### Front-end design - added 10/01/2026

Not from ECC. Each SKILL.md opens with a "Rally notes" block that maps the skill's
web-first advice onto React Native and keeps `lib/theme.ts` as the source of truth.

| Skill | Fires when | Why for Rally |
|---|---|---|
| `ui-ux-pro-max` | Designing, building or reviewing any screen | Searchable local database (UX rules, palettes, type, icons, a React Native stack set) plus a native-app pre-delivery checklist in `references/pro-rules.md`. Python 3 scripts, standard library only, no network. Run as `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack react-native`. |
| `frontend-design` | New screens or a visual rework | Anthropic's guidance on making deliberate, non-templated visual choices and on interface copy (button labels, empty states, errors). |

Sources: `nextlevelbuilder/ui-ux-pro-max-skill` @ `09170ee` (MIT, `LICENSE` copied in;
its `scripts/tests/` left out) and `anthropics/claude-code`
`plugins/frontend-design/skills/frontend-design/SKILL.md` @ `main`. Changes from upstream: script
paths repointed from `${CLAUDE_PLUGIN_ROOT}` to the repo path with `python3`, the Rally notes
blocks, and frontend-design's license line (upstream points at a LICENSE.txt that doesn't exist).

The ui-ux-pro-max repo also ships `ui-styling` (shadcn/Tailwind - web only), `design-system`
(CSS variables; also clashes with the ECC skill of the same name above), and `design`,
`brand`, `banner-design`, `slides` (logos, marketing assets, decks - some need Gemini API
keys). None of those build app screens, so they're not installed.

## Deliberately excluded

- **`liquid-glass-design`** - iOS 26 Liquid Glass, but SwiftUI/UIKit only. Useless in React Native despite the HIG fit.
- **`e2e-testing`** - Playwright. Cannot drive an Expo Go app on a phone. You'd want Maestro, which ECC doesn't have.
- **`ios-icon-gen`** - generates Xcode asset catalogs; Expo uses `app.json`.
- **`frontend-design-direction`** - pushes ECC's house style, which fights your Apple HIG target.
- **All 260-odd others** - Django, Laravel, Kotlin, Solidity, homelab networking, video editing, trading agents. Not your stack.

## Honest gaps - no skill here covers these

1. **PCI / payment compliance.** ECC has no Stripe or PCI skill. `security-review` is
   general application security. Your Stripe Connect Standard setup means funds settle to
   the chapter and you're not merchant of record, which limits exposure a lot - but that's
   an architecture decision, not something a skill enforces.
2. **Location privacy.** Continuous location on college students is Rally's single largest
   legal and reputational risk, and nothing in the catalog addresses it. You need real
   answers on retention, granularity, opt-out, and who can see whom. Apple will also
   require a clear purpose string.
3. **UGC moderation.** The anonymous campus feed is an App Store section 1.2 risk - Apple
   requires content filtering, a report mechanism, user blocking, and a published EULA for
   anonymous UGC. `0007_account_deletion_moderation.sql` is a start. No ECC skill covers
   this, and it's a plausible rejection reason.

## Caveat on `tdd-workflow`

It demands 80% coverage. With ~24 days to launch and no test infrastructure at all, that's
not realistic across the whole app. Suggested scope: apply it to `lib/dues.ts` and the
Stripe webhook only. Money logic is where a silent bug costs you a chapter relationship;
a re-render bug on the feed costs you nothing.

## Source and updating

Copied from `affaan-m/ecc` @ `main`, August 2026. Self-contained - the `../../rules`
links were repointed to the bundled `_rules/react/`. To refresh, re-copy the directories
from the ECC repo. Nothing here auto-updates.
