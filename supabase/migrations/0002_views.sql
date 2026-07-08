-- ============================================================================
-- Greek Life App — 0002_views.sql
-- Derived read models. All are security_invoker so RLS on base tables applies.
-- ============================================================================

-- Latest ping per user
CREATE VIEW public.latest_locations
WITH (security_invoker = true) AS
SELECT DISTINCT ON (l.user_id)
       l.user_id, l.point, l.accuracy_m, l.battery_level, l.place_label, l.captured_at
FROM public.locations l
ORDER BY l.user_id, l.captured_at DESC;

-- One derived birthday entry per active member per org (no stored event rows)
CREATE VIEW public.member_birthdays
WITH (security_invoker = true) AS
SELECT m.org_id, m.user_id, p.full_name, p.birthday
FROM public.memberships m
JOIN public.profiles p ON p.id = m.user_id
WHERE m.status = 'active';

-- Treasurer dashboard: who still owes
CREATE VIEW public.member_balances
WITH (security_invoker = true) AS
SELECT c.org_id,
       c.user_id,
       p.full_name,
       SUM(c.amount_cents) - COALESCE(SUM(paid.paid_cents), 0) AS outstanding_cents,
       MIN(c.due_date) AS oldest_due_date
FROM public.charges c
LEFT JOIN public.profiles p ON p.id = c.user_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(pm.gross_cents), 0) AS paid_cents
  FROM public.payments pm
  WHERE pm.charge_id = c.id AND pm.status = 'succeeded'
) paid ON true
WHERE c.status IN ('unpaid', 'partial')
GROUP BY c.org_id, c.user_id, p.full_name;

-- Unread badge per chat (v7)
CREATE VIEW public.chat_unread_counts
WITH (security_invoker = true) AS
SELECT cm.chat_id,
       cm.user_id,
       COUNT(msg.id) AS unread
FROM public.chat_members cm
LEFT JOIN public.messages msg
  ON msg.chat_id = cm.chat_id
 AND msg.created_at > cm.last_read_at
 AND msg.deleted_at IS NULL
 AND (msg.sender_id IS NULL OR msg.sender_id <> cm.user_id)
GROUP BY cm.chat_id, cm.user_id;
