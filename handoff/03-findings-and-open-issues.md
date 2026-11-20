# Findings from this session (things a new plan should know)

## Found while working

1. **The app has no demo-data mode anymore, but CLAUDE.md says it does.**
   CLAUDE.md says `lib/mock.ts` demo data renders when `.env` is absent. The code says otherwise:
   `lib/mock.ts` and `lib/data.ts` both state there is no mock/demo data. Without Supabase keys,
   `app/(tabs)/_layout.tsx:22` shows only a "Rally isn't configured" screen. CLAUDE.md should be corrected.

2. **Sign-in is email-OTP only, so no automated tester or App Reviewer can sign in.**
   `app/sign-in.tsx` uses `signInWithOtp` + `verifyOtp` (8-digit code), and there's no password path.
   - UNFORGET **S2** (🔴 blocks App Store submission): an App Reviewer cannot log in.
   - UNFORGET **S9** (new this session): the Expo agent only ever sees the sign-in screen.
   - One decision fixes both: a demo/review account and a way to sign in without email. Then write the
     sign-in steps into `.eas/agents/app-facts.md`.

3. **Agentic CI cost/noise.** Once merged and set up, it runs on every non-draft pull request to `main` and fails
   the pull request on any non-PASS verdict. Until S9 is fixed, expect false FAILs. Use draft pull requests.

4. **docs.expo.dev is blocked from cloud sessions.** Expo docs can be read from
   `https://raw.githubusercontent.com/expo/expo/main/docs/pages/...mdx` instead.

5. **The `preview` build profile is for physical devices**, so the agent uses a separate `agent` profile.
   If the `preview` profile ever changes, keep the `agent` profile building for the simulator.

## Inconsistencies spotted in project docs (verify; not changed)

- CLAUDE.md says migrations **0001–0006** are applied. The repo now has **0007–0010** too
  (`account_deletion_moderation`, `dues`, `location_retention`, `last_admin_guard`). Whether those are
  applied to the hosted Supabase project was not checked.
- CLAUDE.md's "App state" lists the anonymous Feed as working. UNFORGET **U2** says the feed is deferred
  out of v1 (target 1.1).
- CLAUDE.md's "Next tasks" list dates from July/August and may not match UNFORGET's current 🔴 rows.
