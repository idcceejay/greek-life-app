# Rally handoff, 2026-11-20 (start here)

Notes from one Claude Code cloud session on 11/20/26, written for a new Claude Code
window that will plan what's next.

## The files

| File | What it covers |
|---|---|
| `00-START-HERE.md` | This page: what each file is and how to use them |
| `01-this-session.md` | Everything done in the 11/20 session: QA Swarm and the UNFORGET row S9 |
| `02-qa-swarm-your-steps.md` | What Ceejay still has to do before QA Swarm can run, with exact commands |
| `03-progress-snapshot.md` | Where the whole app stands on 11/20, open launch blockers, and docs that are out of date |

## Where the work is saved

- Branch: `claude/laughing-davinci-89ho7y` on GitHub (`idcceejay/greek-life-app`).
- It is **not merged into `main`** yet, and there's no pull request.
- Commits on that branch that `main` doesn't have:
  - `11f6707` Add QA Swarm: Claude Code runner, Argent controller, iOS sign-in flows
  - `d32c833` UNFORGET: log S9, QA Swarm needs a test login to reach screens past Sign in
  - The commit that adds this handoff folder

## A prompt you can paste into the new window

> Read every file in `Project-Plan/Handoff-2026-11-20/`, then `CLAUDE.md` and
> `Project-Plan/UNFORGET.md`. Tell me where Rally stands, which items block the App Store
> submission, and propose a new plan with dates. Ask me before you change any files.

If the new window runs on the Mac, get this branch first (Terminal, in the project folder):

```bash
cd ~/Developer/greek-life-app
```
```bash
git fetch origin claude/laughing-davinci-89ho7y && git checkout claude/laughing-davinci-89ho7y && git pull
```
