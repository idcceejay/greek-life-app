-- Demo seed data (local development only — `supabase db reset` runs this).
-- Assumes at least one auth user exists locally; replace the UUIDs as needed.

INSERT INTO public.schools (id, name, location, radius_m) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'University of Georgia',
   ST_SetSRID(ST_MakePoint(-83.3773, 33.9480), 4326)::geography, 8000)
ON CONFLICT DO NOTHING;

INSERT INTO public.school_domains (school_id, domain) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'uga.edu'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'mail.uga.edu')
ON CONFLICT DO NOTHING;
