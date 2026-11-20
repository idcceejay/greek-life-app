# Rally Launch Plan v2 (solo finish, written 11/20/26)

This plan replaces the summer dates in `Launch-Plan.md` and `Road-to-App-Store.md`. Those
two files are kept for history. The list of deferred work and blockers is still
`UNFORGET.md`.

## Decisions (11/20/26)

| Decision | Choice |
|---|---|
| Team | Ceejay alone. Claude Code agents cover backend, security and screens (`Agents-How-To.md`) |
| Expo SDK | Stay on 54 for 1.0. Test on the phone through TestFlight, and upgrade to 57 after launch |
| Location circles | Wait for 1.1. Push the branch so it's safe, but don't merge it |
| Dues | Hidden in 1.0 (`lib/features.ts`). Returns as **Money** (Phase 5) |
| Anonymous feed | Stays cut from 1.0 (hidden by the same switch) |
| Agents | Claude Code agents on the Mac. QA Swarm and Agentic CI wait until after launch |

**Target:** submit around **12/01**, live around **12/08 to 12/12**. Then pilot with the KSU
chapter over winter break, ahead of spring recruitment in January.

## Done in the 11/20 cloud session (branch `claude/tender-tesla-p9u242`)

- Five agents (`.claude/agents/`), shared rules (`.claude/rally-rules.md`), a GitHub CI
  check (typecheck and tests), and a how-to guide.
- Merged the real `rallyorgs.com` support, privacy and terms links, the App Review notes
  and the review-account SQL (closes A1 and S5).
- Dues and Feed hidden behind feature switches. On Home, a Members tile takes the Dues
  tile's place.
- Security:
  - migration **0011**: Stripe RPCs are server-only, and signed-out users can't call
    database functions
  - migration **0012**: closes the chat-join, cross-chapter RSVP and campus-wide
    birthday/phone leaks
  - `supabase/rls_probe.sql`, the cross-chapter test (closes A2 once both are applied)
- Friendly error messages everywhere (A5), large-text date pickers (A6), errors get an
  icon and not just red text (A7), and react-native-maps pinned exactly (A4).
- RSVP (Going / Maybe / Can't go, with who's going) and event editing (P1).
- Tests: 78 passing.

---

## Phase 1: Apply the security fixes (you, about 10 minutes)

The security holes stay open until you paste these into Supabase.

1. Open **supabase.com**, then the **greek-life-app** project, then **SQL Editor**, then
   **New query**.
2. Open `supabase/migrations/0011_lock_down_rpcs.sql` from the repo. Select all of it
   (Cmd+A), copy it, paste it into the editor, and click **Run**. You should see
   "Success. No rows returned".
3. Click **New query** again and do the same with
   `supabase/migrations/0012_close_probe_leaks.sql`.
4. Click **New query** again, paste `supabase/rls_probe.sql`, and click **Run**. **It will
   show an error. That's expected:** the error text *is* the report. Check that:
   - the `control_` lines say 1
   - the `read_` lines say 0
   - every `write_` line says "blocked" or `"ok": false`
   - no line contains the word LEAK
5. Tell Claude it's done, so CLAUDE.md and UNFORGET get updated.

## Phase 2: First TestFlight build (11/24 to 11/26)

1. **Merge this branch.** On GitHub, open a pull request from `claude/tender-tesla-p9u242`
   into `main`, wait for the CI check to go green, and merge it. Then, in Terminal on the
   Mac:
   ```bash
   cd ~/Developer/greek-life-app
   ```
   ```bash
   git checkout main && git pull
   ```
   ```bash
   npm install
   ```
2. **Look at it in the simulator** (steps in CLAUDE.md under "Dev machine"). Check these
   things:
   - there's no Feed tab
   - Home shows Live Map and Members tiles
   - tapping an event opens RSVP
   - Edit works
   - errors show with an icon
   - set Text Size to the largest, open New event, and check the pickers fit
3. **App Review account (S2).** Follow `Project-Plan/App-Review-Notes.md`:
   - Sign in once with `rallyorgsreview@outlook.com`.
   - Run `supabase/app_review_account.sql`.
   - Make a **demo chapter** with about 5 events (a few with RSVPs) and 2 chats.
4. In Claude Code, ask: *"Use the rally-release agent to check if we're ready to build."*
   It has to say GO.
5. Build and upload, one command at a time:
   ```bash
   npx eas-cli build --platform ios --profile production
   ```
   The first time, answer **Y** when it offers to create Apple certificates, and sign in
   with your Apple ID. When the build finishes:
   ```bash
   npx eas-cli submit --platform ios --latest
   ```
6. Install the **TestFlight** app on your iPhone and accept the invite. Then test:
   - sign in
   - join a chapter
   - chat and invite codes
   - the map, with sharing on and off, and ghost mode
   - RSVP and editing an event
   - report and block
   - deleting a throwaway account

## Phase 3: Store listing and submit (11/27 to 12/02)

1. **Screenshots (S3):** 6.9" iPhone (1320×2868), at least 3. Take one each of Home,
   Calendar, an event with RSVP, Chat, Map and Members, using the demo chapter. In
   Terminal:
   ```bash
   xcrun simctl io booted screenshot ~/Desktop/rally-1.png
   ```
   Ask the rally-store agent for captions.
2. **App Store Connect (S6):**
   - Pricing: Free.
   - Availability: United States.
   - Content Rights: "does not contain third-party content".
   - **App Privacy:** email (account), precise location (only while the app is open, for
     the map and check-in), user content (messages), user ID. None of it is used for
     tracking.
   - Age rating stays 13+.
3. **Review sign-in:** fill in the fields and Notes from `App-Review-Notes.md`.
4. Make any fixes from TestFlight (build #2 if needed). Run rally-release, then
   **Submit for Review**.
5. Review usually takes 1-3 days. If it's rejected, paste the message to the rally-store
   agent for a reply and a fix.

## Phase 4: 1.1 (December to January)

These go in this order, each on its own branch:

1. **Push notifications** for new chat messages and event reminders. Uses
   `expo-notifications` (a native change, so it needs a new build) and an Edge Function on
   the existing `devices` and `notifications` tables.
2. **SDK 57 upgrade** on a branch:
   ```bash
   npx expo install expo@^57.0.0
   ```
   ```bash
   npx expo install --fix
   ```
   Then re-test everything. This closes U3 and U4, and Expo Go works on the phone again.
3. **Location circles.** Merge the branch, renumber its migration, and get a rally-security
   review plus the probe.
4. Chat pagination (S8), avatar storage, and a chapter invite preview (A9).
5. Optional: QA Swarm (branch `claude/laughing-davinci-89ho7y`, which needs a paid Expo
   plan). The review account becomes its test login (S9).

## Phase 5: Money, the Dues comeback (January to March)

### Real-world steps first (you)

1. Form an LLC in Georgia (online, about $100, at ecorp.sos.ga.gov).
2. Get a free EIN at irs.gov.
3. Open a business bank account.
4. Create a Stripe account for the LLC and turn on **Connect (Standard)**.

### What gets built

1. **Stripe:**
   - Save `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Supabase secrets (on
     supabase.com, never in chat).
   - Deploy `stripe-connect-link`, `stripe-checkout`, and `stripe-webhook`
     (`--no-verify-jwt`).
   - Point the Stripe webhook at `checkout.session.completed` and `account.updated`.
   - 0011 already makes the webhook's database functions server-only.
2. **Money requests.** The treasurer (or an admin) taps **Request money** and fills in a
   title, an amount, an optional due date, and either everyone or chosen members. This
   builds on the existing `charges` and `dues_cycles` tables, through a new
   `request_money` RPC.
   - Members see it under **Requests**, with a **Pay** button that opens Stripe Checkout
     in the browser. Bank transfer (ACH) is shown first because it costs pennies. Cards
     carry a normal convenience fee.
   - A push notification goes out when a request is sent (needs Phase 4 push).
3. **Spending statement.** This is a bank-statement view of chapter money:
   - **Money in:** Stripe payments plus "paid outside Rally" entries, totaled **per
     request, with no payer names**.
   - **Money out:** expenses the treasurer logs (amount, category, description, date,
     optional receipt photo). This needs a new `org_expenses` table.
   - A running balance, grouped by month.
   - **Who sees it:** treasurers and admins always. Members only when the treasurer turns
     on **"Share spending with members"** in Money settings. That's a new
     `statement_visible` setting, off by default and enforced by database rules (RLS),
     not just hidden in the app.
   - rally-security extends `rls_probe.sql` to prove that members of other chapters never
     see it, and that members don't see it while the switch is off.
4. **Manual "mark paid"** stays for treasurers, labeled "Paid outside Rally (cash/check)".
   No Venmo or Cash App wording, matching the payments decision.
5. **Turn it on:** set `dues: true` in `lib/features.ts`. The screens are JavaScript, so it
   can ship as an EAS Update, and Stripe Checkout opens in the browser, so no new native
   module is needed. Have `Payments-App-Review-Argument.md` ready in case App Review asks.

## Later

- The anonymous feed (U2, P2). Needs a pre-publish filter, a moderator queue, a EULA, and
  a 17+ age rating.
- The Android release.
- Stickers and an ICS calendar feed.
