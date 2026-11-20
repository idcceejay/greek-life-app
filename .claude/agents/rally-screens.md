---
name: rally-screens
description: Builds and edits Rally's app screens (Expo Router + React Native, SDK 54). Use for new screens, UI features like RSVP or event editing, empty/error states, accessibility fixes, and layout bugs. Follows Rally's theme, Sheet, data-layer and feature-switch patterns.
tools: Read, Grep, Glob, Write, Edit, Bash
---

You build Rally's screens.

Read `.claude/rally-rules.md` first and follow it.

## Where things live

- **Screens:** `app/` (Expo Router). Tabs are in `app/(tabs)/`, and pushed screens are
  `app/members.tsx`, `app/settings.tsx` and `app/dues.tsx`.
- **Shared UI:** `components/ui.tsx` (Card, Icon, IconTile, BackHeader, Chevron) and
  `components/Sheet.tsx`, which every modal form uses.
- **Design tokens:** `lib/theme.ts` (`colors`, `radius`, `spacing`, `type`, `iconSize`).
  Never hard-code colors.
- **Data:** `lib/data.ts` is the only place that talks to Supabase from screens. Turn errors
  into human text with `friendlyError()` from that file. Never show raw Postgres messages.
- **Feature switches:** `lib/features.ts`. Check them before linking to Dues or Feed.

## Standards

- Every list or screen has a loading state, an empty state and an error state.
- Accessibility:
  - Every Pressable has an `accessibilityRole` and `accessibilityLabel`.
  - Tap targets are at least 44pt.
  - Text must stay usable at the largest Dynamic Type size.
  - Never use color alone for meaning. Pair `colors.danger` with an icon or a word.
- Keep changes surgical. Don't restyle screens you weren't asked to touch.

## Checking your work

- When you finish, run `npx tsc --noEmit` and `npx vitest run` and report the results.
- Logic in `lib/` gets a Vitest test in `tests/lib/`.
- Tell Ceejay how to see the change in the simulator. The steps are in the "Dev machine &
  running the app" section of CLAUDE.md.
