# What the 11/20/26 session did

## Goal

Add Expo's **QA Swarm** workflow. Several AI test agents each open Rally on their own
cloud iOS simulator at the same time, follow one short test "flow", and report PASS or FAIL
with screenshots.

Source docs: https://docs.expo.dev/agentic-workflows/qa-swarm.md and
https://docs.expo.dev/agentic-workflows/setup.md. The cloud session couldn't reach
docs.expo.dev (blocked by a network policy), so with Ceejay's OK the files were copied from
the same pages in Expo's GitHub repo (`expo/expo`, `docs/pages/agentic-workflows/`, commit
`85eae56`, 11/19/26).

## Decisions Ceejay made

| Question | Choice |
|---|---|
| Coding agent | **Claude Code** |
| Device controller | **Argent** (not agent-device) |
| Build profile | A **new `agent` profile** for simulator builds. `preview` is unchanged and still builds for real iPhones |
| Platforms | **iOS only.** The Android jobs from the docs' example were removed |
| What the flows test | **The Sign in screen only.** Every other screen needs an 8-digit code sent by email, which a test agent can't read |

## Files added or changed (commit `11f6707`)

| File | What it is | Copied exactly from the docs? |
|---|---|---|
| `.eas/agents/run-agent.sh` | Runs Claude Code without a person (`device` and `change` modes) | Yes (Claude Code version) |
| `.eas/agents/start-session.sh` | Starts the Expo cloud simulator for Argent and writes the device details for the agent | Yes (Argent version) |
| `.eas/agents/qa-lane.md` | Instructions every test agent gets | Yes |
| `.eas/agents/qa-lane.sh` | Script each test lane runs: start simulator, run agent, build evidence site, verdict | Yes |
| `.eas/qa-flows/launch.md` | Docs example: the app opens with no error | Yes |
| `.eas/qa-flows/sign-in.md` | **Rally flow:** Sign in shows "Rally", the title, the .edu text, the `you@school.edu` field and "Send code"; the keyboard opens | Written for Rally |
| `.eas/qa-flows/email-check.md` | **Rally flow:** typing `rally-test` (no @) and tapping Send code shows "Enter a valid email address." No email is sent | Written for Rally |
| `.eas/agents/app-facts.md` | Rally facts for the agent: only Sign in is reachable; never send a code; never sign in | Written for Rally |
| `.eas/workflows/qa-swarm.yml` | The workflow: 3 iOS lanes (launch, sign-in, email-check) on the `agent` profile, plus a report | Docs version, changed to iOS only, the `agent` profile and Rally's flows |
| `eas.json` | New `agent` profile: extends `base`, internal distribution, `environment: preview`, `ios.simulator: true` | Docs keys, put in a separate profile as the docs advise |
| `.gitignore` | Ignores `.env.eas-simulator` (holds a session token) and `agent-output/` | Yes |

Left out on purpose:

- The docs' `navigation.md` example, because it would fail at sign-in.
- The optional `pr_comment` job, because it needs the GitHub token step, which Ceejay skipped.

## Checks run

- `eas.json` reads as valid JSON. All `.sh` files pass a syntax check (`bash -n`).
- Packages were installed with `npm ci` (exact lockfile, no version changes) so the validator
  could read the app config.
- `eas workflow:validate .eas/workflows/qa-swarm.yml` passed the YAML check, then stopped with
  "An Expo user account is required to proceed". **Not finished:** Ceejay has to run it
  logged in to Expo (see `02-qa-swarm-your-steps.md`).
- QA Swarm has **never been run**. Nothing has been tested on a real cloud simulator yet.

## UNFORGET.md (commit `d32c833`)

Added row **S9** (🔵 NEXT, owner Ceejay): *QA Swarm test agents can only reach the Sign in
screen; no test login exists for Home, Calendar, Chats.*

- It's the same problem as **S2** (an App Review reviewer can't receive the emailed code), so
  one decision should fix both.
- Options: (1) a password login for one test account; (2) a fixed code for one test address.
  Either is JS-only, so it can ship as an Expo update without a new build.
- Safety: use a test chapter with no real members, and store the test password as a Secret in
  the EAS **preview** environment, never in a flow file. The test agent can read every
  variable in **preview**, and so can anyone who can push a branch.

## Pushed

Both commits are pushed to `origin/claude/laughing-davinci-89ho7y`. Not merged into `main`.
