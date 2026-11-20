# Session summary: Expo agentic workflows added (2026-11-20)

Cloud Claude Code session on repo `idcceejay/greek-life-app` (app name: Rally).

## What was asked

Add Expo's **Bug triage** agentic workflow, following https://docs.expo.dev/agentic-workflows/bug-triage.md.
Its prerequisites came with it: the one-time **project setup**, **Agentic CI**, and **Issue to PR**.
Rules for the session: ask before any token, account, or choice; never print or save a token; run
`eas workflow:validate`; commit but don't push (the owner later said "push it").

## Choices the owner made

| Question | Answer |
|---|---|
| Coding agent (picks `run-agent.sh`) | **Claude Code** |
| Device controller (picks `start-session.sh`) | **agent-device** |
| Platform | **iOS only** |
| Backend for the agent's test build | **Live Supabase** |

## What was done

- None of the workflows existed before. All three were added, plus the setup files.
- docs.expo.dev is blocked from the cloud session, so each file was copied by exact line range from
  Expo's own docs source on GitHub (`expo/expo` main, `docs/pages/agentic-workflows/*.mdx`). The text
  could differ slightly from the published page.
- **Commit:** `5aa4013` "Add Expo agentic workflows: Agentic CI, Issue to PR, Bug triage (iOS)".
- **Branch:** `claude/tender-davinci-cltxlu`, pushed to GitHub.
- **Pull request:** draft [idcceejay/greek-life-app#4](https://github.com/idcceejay/greek-life-app/pull/4)
  into `main`. It was clean when last checked: no conflicts, no checks run, no reviews.
- The session subscribed to activity on #4 and scheduled one safety-net check-in for about
  2026-11-20 04:25 UTC. Those only live in that cloud session. A new Claude window does not inherit them.

## Files in the commit

| File | Source / purpose |
|---|---|
| `.eas/agents/run-agent.sh` | setup page, Claude Code version. Runs the agent without a person, in `device` or `change` mode |
| `.eas/agents/start-session.sh` | setup page, agent-device version. Starts an Expo Simulators session and writes `agent-output/device.md` |
| `.eas/workflows/agentic-ci.yml` | Agentic CI, iOS version. Tests each non-draft pull request to `main` and posts PASS/FAIL |
| `.eas/agents/check-pr.md` | Agentic CI prompt |
| `.eas/agents/github.mjs` | Bug triage version (Issue to PR version + `create-issue`) |
| `.eas/agents/make-change.sh` | Issue to PR job script (clone, run agent, push `agent/issue-<n>`, open pull request) |
| `.eas/agents/make-change.md` | Issue to PR prompt |
| `.eas/workflows/issue-to-pr.yml` | Issue to PR workflow (manual / started by the GitHub Action) |
| `.github/workflows/agent-label.yml` | GitHub Action: the `agent` label on an issue starts Issue to PR |
| `.eas/agents/reproduce.sh` | Bug triage job script |
| `.eas/agents/reproduce.md` | Bug triage prompt |
| `.eas/agents/feedback-issue.mjs` | Turns TestFlight feedback into a GitHub issue (iOS only) |
| `.eas/workflows/bug-triage.yml` | Bug triage, iOS version. Manual run with `-F issue_number=N`, or started by TestFlight feedback |
| `eas.json` | **Changed:** new `agent` build profile (see below) |
| `.gitignore` | **Changed:** adds `.env.eas-simulator` and `agent-output/` |
| `Project-Plan/UNFORGET.md` | **Changed:** new row **S9** |

## Differences from the docs

1. **New `agent` build profile.** The existing `preview` profile builds for real iPhones
   (`ios.simulator: false`). The setup page says that in this case you add a separate profile, so `eas.json` got:
   ```json
   "agent": { "extends": "base", "distribution": "internal", "environment": "preview", "ios": { "simulator": true } }
   ```
   `profile: preview` became `profile: agent` in `agentic-ci.yml` and `bug-triage.yml`. It extends
   `base`, so it gets the live Supabase URL and publishable key.
2. **No `.eas/agents/app-facts.md`.** The docs example describes an imaginary app. Real Rally facts
   depend on fixing sign-in (S9).

## Checks that ran

- YAML parse: all 4 workflow files pass. `bash -n`: all 4 `.sh` files pass. `node --check`: both `.mjs` files pass.
- `eas.json` is valid JSON.
- `eas workflow:validate` did **not** pass yet. It needs an Expo login, which the cloud session doesn't
  have. The owner must run it on the Mac (see `02-remaining-setup-steps.md`).
- `npm ci` ran in the cloud container so the validator could read the app config. It did not change
  `package.json` or `package-lock.json`.
