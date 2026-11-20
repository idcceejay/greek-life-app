# QA Swarm: what Ceejay still has to do

The files are on the branch `claude/laughing-davinci-89ho7y`. QA Swarm can't run until
these steps are done. Never paste a token or key into a chat window. Paste them only on
expo.dev.

## Status of each setup step (from the Expo setup page)

| Step | Status |
|---|---|
| Project uses CNG (no `ios`/`android` folders in the repo) | ✅ Done |
| App ID in `app.json` (`com.rallygreek.rally`) | ✅ Done |
| Project linked to Expo (`eas init`, owner `idc_ceejay`) | ✅ Done |
| EAS CLI installed on the Mac | ⬜ To do |
| Expo Simulators access (needs a paid Expo plan) | ⬜ To check |
| 1. Build profile for the simulator | ✅ Done (`agent` profile) |
| 2. Connect GitHub to the Expo project | ⬜ To do (expo.dev) |
| 3. Robot user + token (Developer role) | ⬜ To do (expo.dev) |
| 4. Tokens as Secrets in the **preview** environment | ⬜ To do (expo.dev) |
| 5. Agent runner (Claude Code) | ✅ Done |
| 6. Device controller (Argent) | ✅ Done |
| 7. `.gitignore` lines + push | ✅ Done |
| 8. GitHub token | Skipped (only needed to post reports on pull requests) |
| `eas workflow:validate` | ⬜ Must run logged in |

## In Terminal on the Mac (one command at a time)

```bash
cd ~/Developer/greek-life-app
```
```bash
git fetch origin claude/laughing-davinci-89ho7y && git checkout claude/laughing-davinci-89ho7y && git pull
```
```bash
npm install --global eas-cli
```

Log in with the `idc_ceejay` account. The password won't show while you type; that's normal.
```bash
eas login
```

Check simulator access. It must say `"available": true`; `false` means the account needs a
paid Expo plan.
```bash
eas simulator:availability --json
```
```bash
eas workflow:validate .eas/workflows/qa-swarm.yml
```

## On expo.dev (in the browser)

1. **Connect GitHub:** open the Rally project → **Project settings** → **GitHub**, and connect
   `idcceejay/greek-life-app`.
2. **Robot token:** **Account settings** → **Access tokens** → **Robot users**. Create a robot
   user with the **Developer** role, then create a token for it.
3. **Claude key:** in Terminal, run `claude setup-token` (needs a Pro, Max, Team or Enterprise
   plan).
4. **Add both as Secrets:** open the project → **Environment variables** → **Add Variables**.
   Choose the **preview** environment and **Secret** visibility:
   - `EXPO_TOKEN_SIMULATOR` = the robot token
   - `CLAUDE_CODE_OAUTH_TOKEN` = the Claude key
5. Keep no other secrets in **preview**, because the test agent can read all of it.

Check that both are there:
```bash
eas env:list --environment preview
```

## First run

```bash
eas workflow:run .eas/workflows/qa-swarm.yml --ref claude/laughing-davinci-89ho7y
```

The results show up on the workflow run page on expo.dev as a **QA Swarm report**: PASS or
FAIL for each lane, with a link to its evidence site.

## Good to know

- **Cost:** each run uses 3 cloud simulator sessions (up to 30 minutes each), one EAS build
  or repack, and Claude usage for each lane.
- **Public evidence:** evidence sites on Expo Hosting are public to anyone with the link.
  Today they only show the Sign in screen.
- **Third-party tool:** the docs say to read the code of `eas-simulator-evidence@0.2.4` before
  using it, because it runs with the robot token.
- **The verdict can be wrong.** Read the evidence before reporting a bug. A false FAIL is
  usually fixed by adding facts to the flow or to `.eas/agents/app-facts.md`.
- **Limited reach:** the flows can only test Sign in until a test login exists (UNFORGET S9,
  tied to S2).
