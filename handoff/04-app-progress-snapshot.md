# Rally: progress snapshot (from the repo, 2026-11-20)

Facts below come from git history and `Project-Plan/UNFORGET.md` on `main`. Nothing was tested in a simulator this session.

## Basics

- Expo SDK **54** (pinned), React 19.1.0, React Native 0.81.5, Expo Router, Supabase (Postgres + PostGIS, email OTP).
- Bundle id `com.rallygreek.rally`, App Store Connect app 6797647574, Expo owner `idc_ceejay`.
- No build has reached TestFlight (S4).

## Recent work on `main` (newest first)

- Calendar: shows the date after the weekday on event cards
- Calendar: shows Apple/Google phone calendars alongside chapter events (`expo-calendar`)
- UNFORGET: closed S1 (the app renders in the iPhone 17 simulator), logged A6–A9 from the UI redesign
- Dues: shows the real next deadline (Due / Overdue since) on the balance card
- Shared BackHeader, Members usernames + role chips, Map ghost-mode switch
- Home + Calendar: setup progress, one New event action, smart defaults
- Ionicons tab bar + shared Icon components; new slate #374151 + rose #E11D48 palette
- Bumped expo to 54.0.37 / expo-updates 29.0.20 via `expo install --fix`
- Dues data-layer + Stripe webhook tests merged (61/61 passing as of 2026-10-01)
- Accessibility pass (labels, roles, live regions, WCAG AA contrast)

## What exists in the code

- **Screens:** tabs Map, Chats, Home, Calendar, Feed; plus `chat/`, `dues.tsx`, `members.tsx`, `onboarding.tsx`, `settings.tsx`, `sign-in.tsx`.
- **Migrations:** `0001_init` … `0010_last_admin_guard` (10 files).
- **Edge functions (not deployed):** `stripe-checkout`, `stripe-connect-link`, `stripe-webhook` (P3, blocked on forming an LLC).
- **Tests:** Vitest (`npm test`) in `tests/`.
- **New this session:** Expo agentic workflows in `.eas/` + `.github/workflows/agent-label.yml` (draft PR #4, not merged).

## Open UNFORGET rows

### 🔴 THIS: blocks the 1.0 App Store submission
| # | Item |
|---|---|
| S2 | App Review sign-in: reviewer can't log in with 8-digit email OTP; needs a demo-account decision |
| S3 | 0 of 10 screenshots in App Store Connect (minimum 3) |
| S4 | No EAS build has ever reached TestFlight |
| S5 | Terms of Use not linked in-app (Guideline 1.2) |
| S6 | Pricing, Availability, Content Rights unset in App Store Connect (~10 min) |
| A1 | `settings.tsx:30-31` link to rallyapp.com, a domain we don't own |
| A2 | Cross-org RLS security audit never run (student location data) |

### 🔵 NEXT
| # | Item |
|---|---|
| P1 | RSVP UI lost with the dead Windows SSD; rebuild |
| S8 | Feed and chat load a fixed 50 rows (needs cursor paging) |
| S9 | Expo agent can't get past email-OTP sign-in (same fix as S2) |
| A4 | `react-native-maps` declared with a caret `^1.20.1` |
| A5 | Raw Postgres error strings shown to users |
| A6 | Date/time pickers clip at the largest text size |
| A7 | Danger red too close to the rose accent |
| U3 | Owner decision: upgrade to SDK 57, or use an EAS dev build (phone's Expo Go is SDK 57) |

### 🟡 LATER
P2 (moderation queue migration), P3 (Stripe, blocked on LLC), A8 (dues late fee), A9 (invite preview), U2 (anonymous feed → 1.1), U4 (Xcode 27 Device Hub workaround).

## Suggested starting questions for the new plan

1. S2 + S9: how should a reviewer or test agent sign in (demo account, password sign-in, or a fixed test code)?
2. U3: SDK 57 upgrade or EAS dev build? This affects S4 (TestFlight) too.
3. Finish the agentic-workflow setup now (`02-remaining-setup-steps.md`), or after TestFlight works?
