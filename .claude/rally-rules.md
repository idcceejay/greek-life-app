# Rally rules every agent follows

This file is not an agent. All agents in `.claude/agents/` read it, so the rules live in one place.

If the `rally-guardrails` skill is available, load it first. These rules apply either way:

- **Packages:** never run `npm update` or `npm audit fix --force`. Change a package only with
  `npx expo install <pkg> --fix`. `react` stays at exactly 19.1.0, `react-native` at 0.81.5,
  and Expo at SDK 54.
- **`app.json` plugins:** only real config plugins (`expo-router`, `expo-location`).
- **Database:** migrations are append-only and numbered (`supabase/migrations/00NN_name.sql`).
  Never edit an applied one. Ceejay pastes each one into the Supabase SQL editor by hand, one
  file at a time.
- **Writes:** anything RLS blocks from the client becomes a `SECURITY DEFINER` RPC with an
  explicit permission check and `SET search_path = public` (see `0005_app_rpcs.sql`).
- **Money and time:** money is integer cents, and timestamps are `timestamptz`.
- **Location:** foreground only, opt-in, with ghost mode. No background tracking and no speed
  features. These are owner decisions.
- **Forms:** every modal form uses `components/Sheet.tsx`, never RN `Modal animationType="slide"`.
- **Design:** tokens come from `lib/theme.ts`.
- **Data:** all live data goes through `lib/data.ts`, and every screen needs an empty state.
- **Secrets:** never commit `.env`, never put the `service_role` key in the app, and never ask
  Ceejay to paste a secret into chat.
- **Git:** never force-push. Commit before any checkout, stash or reset. Ask before pushing.
- **Feature switches:** `lib/features.ts`. Dues and Feed are off for 1.0, so don't remove that
  code.
- **Deferred work:** log it as a row in `Project-Plan/UNFORGET.md`. Don't start a new tracking
  file.
- **Talking to Ceejay:** Ceejay isn't a fluent terminal user. Give exact copy-paste commands,
  one per code block, and say which app to paste them into. Use plain words.
