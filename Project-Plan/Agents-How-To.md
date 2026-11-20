# Rally agents: how to use them (solo edition)

Rally has five AI helpers ("agents") built into the project. Each one is a Claude Code
assistant with one job and its own standing instructions. They cover what Cooper (backend and
security) and TJ (screens) used to do. They're free with your Claude plan, and you run them
from Terminal on your Mac.

## The five agents

| Agent | Ask it when… | Example request |
|---|---|---|
| **rally-security** | Before every build, and after any database change | "Use rally-security to run the cross-chapter probe and check the advisors." |
| **rally-migration** | You need a database change (new table, new RPC, permissions) | "Use rally-migration to add a late-fee column to dues cycles." |
| **rally-screens** | You want a screen built or fixed | "Use rally-screens to add a 'Going' count to event cards." |
| **rally-release** | Right before `eas build` | "Use rally-release to check if we're ready to build." |
| **rally-store** | App Store Connect work, or a rejection email | "Use rally-store to write the What's New text for 1.0.1." |

They all follow the same rules in `.claude/rally-rules.md`: the version pins, Sheet.tsx, money
in cents, no background location, and append-only migrations. You don't have to repeat those
rules in your requests.

## How to start one

1. Open **Terminal** on the Mac.
2. Paste this and press Enter:
   ```bash
   cd ~/Developer/greek-life-app
   ```
3. Then start Claude Code:
   ```bash
   claude
   ```
4. To see the list of agents, type `/agents` and press Enter. Press Esc to close the list.
5. Ask in plain English and name the agent, for example: *Use the rally-release agent to check
   if we're ready to build.*

You can also just describe the job without naming an agent. Claude picks the right one from
its description.

## Running several at once

You can ask for more than one in a single message:

> Have rally-screens build RSVP buttons while rally-security reviews migration 0011.
> When both finish, run rally-release.

The agents work side by side and report back to your main Claude window. Read their summaries
before you approve anything that pushes code or touches the live database.

## A good weekly loop (solo)

1. **Monday:** "Read `Project-Plan/UNFORGET.md` and `Project-Plan/Launch-Plan-v2.md`. What
   should I do this week?"
2. **During the week:** one feature or fix per branch. Use rally-screens or rally-migration.
3. **Before merging:** rally-security (if the database changed), then rally-release.
4. **Friday:** "Update UNFORGET.md with what got done and what got put off."

## Making a new agent

1. In Finder, open `greek-life-app/.claude/agents/`.
2. Copy any file, for example `rally-store.md`, and rename it, for example
   `rally-marketing.md`.
3. Open it in TextEdit and change three things:
   - the `name:` line at the top
   - the `description:` line. Claude reads this to decide when to use the agent, so say
     clearly what it's for.
   - the instructions under the second `---`
4. Save, and restart `claude`. Check that the new agent shows up in `/agents`.

You can also type `/agents` and choose **Create new agent**, and Claude will walk you through
it.

## Later (after launch): cloud test robots

Expo's **QA Swarm** runs test agents on cloud iPhone simulators. That setup is saved on the
branch `claude/laughing-davinci-89ho7y`, with steps in its
`Project-Plan/Handoff-2026-11-20/02-qa-swarm-your-steps.md`. It needs a paid Expo plan and a
test login, so it's parked until after the 1.0 launch. The other agentic setup (Agentic CI and
bug triage, draft PR #4) is parked too. The two clash with each other, so pick only one when
the time comes.

## Safety rules for agents

- Agents never get your passwords or keys. Never paste a key into the chat.
- Against the live database, agents may only run read-only checks or scripts that end in
  `ROLLBACK`. Real changes go through a migration file that you paste into Supabase yourself.
- Agents ask before pushing to GitHub, and never force-push.
