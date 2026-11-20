# Remaining steps before the agentic workflows can run

None of these are done yet. Only the owner can do them: they need the Expo login, tokens, and website settings.
Run the commands in the **Terminal** app on the Mac, in `~/Developer/greek-life-app`.

## 1. Get the branch on the Mac

```bash
git fetch origin claude/tender-davinci-cltxlu
```
```bash
git checkout claude/tender-davinci-cltxlu
```

## 2. EAS CLI, login, Expo Simulators access

```bash
npm install --global eas-cli
```
```bash
eas login
```
```bash
eas simulator:availability --json
```
The last command must print `"available": true`. If it prints `false`, the Expo account (`idc_ceejay`) needs a paid plan.
The project is already linked to Expo: `app.json` has `extra.eas.projectId`.

## 3. Validate the workflow files (not done yet)

```bash
eas workflow:validate .eas/workflows/agentic-ci.yml
```
```bash
eas workflow:validate .eas/workflows/issue-to-pr.yml
```
```bash
eas workflow:validate .eas/workflows/bug-triage.yml
```

## 4. Create the agent's key

```bash
claude setup-token
```
Copy the token straight into the Expo dashboard in step 5. Never paste it into a chat.

## 5. Website steps

- [ ] **Connect GitHub:** on expo.dev, open the Rally project and connect the `idcceejay/greek-life-app` repository.
- [ ] **Robot user:** go to expo.dev → Account settings → **Access tokens** → **Robot users**. Create one with the **Developer** role, then create **two** tokens for it.
- [ ] **GitHub token:** on github.com/settings/personal-access-tokens/new, create a fine-grained token for **only** this repository. Give it Contents, Issues and Pull requests, each set to "Read and write".
- [ ] **Expo environment variables:** go to Project settings → Environment variables, **preview** environment:

| Name | Value | Visibility |
|---|---|---|
| `EXPO_TOKEN_SIMULATOR` | robot token #1 | Secret |
| `CLAUDE_CODE_OAUTH_TOKEN` | key from step 4 | Secret |
| `GITHUB_TOKEN` | the GitHub token | Secret |
| `GITHUB_REPOSITORY` | `idcceejay/greek-life-app` | Plain text |

The agent can read every variable in **preview**, so keep no other secrets there.

## 6. Check the variables, add the GitHub secret, and create the labels

```bash
eas env:list --environment preview
```
```bash
gh secret set EXPO_TOKEN
```
(It asks for the value: paste robot token #2 there, not in a chat.)
```bash
gh label create agent --description "Start the coding agent"
```
```bash
gh label create testflight
```

## 7. Optional: Bug triage from TestFlight feedback

- [ ] Connect the App Store Connect app (id 6797647574) to the Expo project. Testers' feedback only starts the workflow after this.
- [ ] Make sure Expo has an App Store Connect API key:
```bash
eas credentials --platform ios
```
This path also needs a build in TestFlight. UNFORGET S4 says no build has reached TestFlight yet.

## 8. When to take PR #4 out of draft

Only after steps 2–6 are done **and** the agent can sign in (UNFORGET S9). Until then, Agentic CI will mark most
pull requests `FAIL`. Every run uses build time, simulator time, and Claude usage.

## How to use the workflows once set up

- **Agentic CI:** open a non-draft pull request to `main`. It runs automatically.
- **Bug triage:** create an issue with the bug steps, then:
  ```bash
  eas workflow:run .eas/workflows/bug-triage.yml --ref main -F issue_number=<number>
  ```
- **Issue to PR:** add the `agent` label to an issue. This only works after `agent-label.yml` is merged into `main`.
