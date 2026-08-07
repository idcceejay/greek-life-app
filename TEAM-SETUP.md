# Rally — teammate setup (Cooper & TJ)

Everything below takes about 15 minutes, once.

## 1. Get the code

```bash
git clone https://github.com/idcceejay/greek-life-app.git
cd greek-life-app
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required. **Never run `npm update` or
`npm audit fix --force`** — it breaks the Expo SDK 54 pin and the app stops loading.

## 2. Create your `.env`

Copy `.env.example` to a new file named `.env` and paste in the two values Ceejay
sends you (they're not in git on purpose):

```
EXPO_PUBLIC_SUPABASE_URL=<ask Ceejay>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ask Ceejay>
```

That key is the public client key — safe on your machine, just not committed.

## 3. Run it

```bash
npx expo start
```

Install **Expo Go** from the App Store, scan the QR with your Camera app.
Sign in with your school email; you'll get an 8-digit code by email.

Note: the live map only renders in a real build (TestFlight/dev build), not in
Expo Go — you'll see a styled placeholder there. Everything else works.

## 4. Read the context

- `CLAUDE.md` — full architecture + conventions. If you use Claude Code, `cd` into
  this folder and run `claude`; it reads this file automatically.
- `Project-Plan/Road-to-App-Store.md` — who owns what, the schedule, and the
  App Review / security checklists.

## 5. Working agreements

- Branch per feature (`feature/roster`), PR into `main`. No direct commits to main.
- Migrations are append-only: add `0008_…`, never edit an applied one.
- If RLS blocks a two-step client operation, write a `SECURITY DEFINER` RPC —
  see `create_organization` / `create_group_chat` for the pattern.
- All modal forms use `components/Sheet.tsx`, not React Native's `Modal`.
- Update `CLAUDE.md` when architecture changes.

## Who needs what access

| | GitHub | Supabase dashboard | Apple |
|---|---|---|---|
| Cooper (backend) | yes | **yes** — needed for SQL, RLS, logs | no |
| TJ (mobile) | yes | optional (read-only is fine) | no |
| Ceejay | owner | owner | owner |
