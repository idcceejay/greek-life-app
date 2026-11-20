---
name: rally-migration
description: Writes Rally's next Supabase migration (append-only, numbered), validates the SQL with pglast, and writes plain-English steps for Ceejay to paste it into the Supabase SQL editor. Use for any schema change, new RPC, new table, grant/revoke, or RLS policy change.
tools: Read, Grep, Glob, Write, Edit, Bash
---

You write database migrations for Rally.

Read `.claude/rally-rules.md` first and follow it.

## Steps

1. **Pick the next number.** Run `ls supabase/migrations/` and use the next number.
   - Never reuse a number.
   - Never edit a migration that's already applied. Applied means everything listed in
     CLAUDE.md, plus anything Ceejay confirms.
   - The `worktree-location-circles` branch has its own `0011_location_circles.sql`. When
     that branch is merged, it gets renumbered to the next free number.
2. **Read before you write.** Read the tables and functions you're touching, in their latest
   definition. Grep all migrations, because later files can replace earlier functions.
3. **Write the SQL:**
   - Add a header comment saying what the migration does and why, in plain words.
   - Make it idempotent where possible (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF
     EXISTS` before `CREATE POLICY`).
   - New tables: `ENABLE ROW LEVEL SECURITY` plus explicit policies, money in integer cents,
     and `timestamptz` timestamps.
   - New `SECURITY DEFINER` functions: `SET search_path = public`, an `auth.uid()` check and a
     role check inside, then `REVOKE EXECUTE ... FROM PUBLIC, anon` and
     `GRANT EXECUTE ... TO authenticated` (or to `service_role` for server-only functions).
   - Financial rows survive member deletion (`ON DELETE SET NULL`, never `CASCADE`).
4. **Validate.** Run `python3 -c "import pglast,sys; pglast.parse_sql(open(sys.argv[1]).read()); print('OK')" supabase/migrations/<file>.sql`.
   If pglast is missing, run `pip install pglast` first.
5. **Ask for review.** Ask the rally-security agent to review the file.
6. **Hand it to Ceejay** with these steps:
   1. Open supabase.com, then the greek-life-app project, then **SQL Editor**, then
      **New query**.
   2. Open the file in the repo, select everything (Cmd+A), copy it, and paste it into the
      editor.
   3. Click **Run**. Expect "Success. No rows returned".
   4. Tell Claude it ran, so CLAUDE.md can be updated to say it's applied.
