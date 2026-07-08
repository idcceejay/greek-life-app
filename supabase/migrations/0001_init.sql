-- ============================================================================
-- Greek Life App — 0001_init.sql (schema v7)
-- Extensions, enums, tables, constraints, indexes, triggers.
-- Implements Database/greek_life_erd_reference_v6.md + v7.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "postgis";      -- geography(Point,4326)
CREATE EXTENSION IF NOT EXISTS "citext";       -- case-insensitive text
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
CREATE TYPE public.org_type              AS ENUM ('fraternity','sorority','club','organization');
CREATE TYPE public.account_type          AS ENUM ('student','alumni');
CREATE TYPE public.affiliation_status    AS ENUM ('current','past');
CREATE TYPE public.verification_method   AS ENUM ('email_otp','sso','sheerid','document');
CREATE TYPE public.membership_role       AS ENUM ('admin','treasurer','user','alumni');
CREATE TYPE public.membership_status     AS ENUM ('pending','active','removed');
CREATE TYPE public.invitation_status     AS ENUM ('pending','accepted','declined','expired','revoked');
CREATE TYPE public.event_visibility     AS ENUM ('org','public');
CREATE TYPE public.rsvp_status           AS ENUM ('going','maybe','not_going');
CREATE TYPE public.chat_type             AS ENUM ('group','dm','announcement');
CREATE TYPE public.chat_member_role      AS ENUM ('member','admin');
CREATE TYPE public.post_scope            AS ENUM ('campus','chapter');
CREATE TYPE public.payment_rail          AS ENUM ('stripe_connect','omegafi','remembers_choice','remembers_unified');
CREATE TYPE public.reconcile_mode        AS ENUM ('webhook','api_reconcile','redirect_only');
CREATE TYPE public.payment_account_status AS ENUM ('pending','active','restricted');
CREATE TYPE public.dues_scope            AS ENUM ('all','new_members','custom');
CREATE TYPE public.charge_category       AS ENUM ('national_dues','local_dues','social','merch','event','fine');
CREATE TYPE public.charge_status         AS ENUM ('unpaid','partial','paid','waived','void');
CREATE TYPE public.payment_channel       AS ENUM ('card','ach','apple_pay');
CREATE TYPE public.payment_status        AS ENUM ('pending','succeeded','failed','refunded','disputed');
CREATE TYPE public.reconciliation_source AS ENUM ('stripe_webhook','greek_api','manual');
CREATE TYPE public.instrument_type       AS ENUM ('card','ach');
CREATE TYPE public.plan_schedule         AS ENUM ('full','monthly','custom');
CREATE TYPE public.plan_status           AS ENUM ('active','completed','defaulted');
CREATE TYPE public.installment_status    AS ENUM ('scheduled','paid','late','failed');
CREATE TYPE public.payout_status         AS ENUM ('pending','paid');
-- v7
CREATE TYPE public.report_target         AS ENUM ('post','comment','message','profile');
CREATE TYPE public.report_reason         AS ENUM ('harassment','hate','spam','danger','other');
CREATE TYPE public.report_status         AS ENUM ('open','actioned','dismissed');
CREATE TYPE public.device_platform       AS ENUM ('ios','android','web');
CREATE TYPE public.notification_kind     AS ENUM ('chat_message','event_invite','event_reminder','rsvp_update','dues_charge','dues_reminder','payment_receipt','membership','poll','moderation');

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- ----------------------------------------------------------------------------
-- Identity & campus
-- ----------------------------------------------------------------------------
CREATE TABLE public.schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  location    geography(Point,4326),
  radius_m    integer NOT NULL DEFAULT 8000,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.school_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  domain     citext NOT NULL UNIQUE
);

CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      citext UNIQUE,
  full_name     text,
  birthday      date NOT NULL,
  account_type  public.account_type NOT NULL DEFAULT 'alumni',
  edu_verified  boolean NOT NULL DEFAULT false,
  is_suspended  boolean NOT NULL DEFAULT false,          -- v7
  school_email  citext UNIQUE,
  avatar_url    text,
  phone         text,
  school_id     uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.school_affiliations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  school_email        citext NOT NULL,
  status              public.affiliation_status NOT NULL DEFAULT 'current',
  verified_at         timestamptz,
  verification_method public.verification_method,
  verification_ref    text,
  started_at          date,
  ended_at            date,
  reverify_by         date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);
CREATE UNIQUE INDEX uq_affiliation_one_current
  ON public.school_affiliations (user_id) WHERE (status = 'current');

-- Enforce: affiliation email domain must be registered for that school
CREATE OR REPLACE FUNCTION public.tg_check_affiliation_domain() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE dom citext;
BEGIN
  dom := split_part(NEW.school_email::text, '@', 2);
  IF NOT EXISTS (
    SELECT 1 FROM public.school_domains sd
    WHERE sd.school_id = NEW.school_id AND sd.domain = dom
  ) THEN
    RAISE EXCEPTION 'Email domain % is not registered for this school', dom;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_affiliation_domain BEFORE INSERT OR UPDATE OF school_email, school_id
  ON public.school_affiliations
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_affiliation_domain();

-- ----------------------------------------------------------------------------
-- Orgs & membership
-- ----------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          citext UNIQUE,
  type          public.org_type NOT NULL DEFAULT 'organization',
  description   text,
  avatar_url    text,
  primary_color text,
  school_id     uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.memberships (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      public.membership_role NOT NULL DEFAULT 'user',
  status    public.membership_status NOT NULL DEFAULT 'pending',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- Alumni cannot hold the admin role
CREATE OR REPLACE FUNCTION public.tg_check_alumni_not_admin() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'admin' AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.account_type = 'alumni'
  ) THEN
    RAISE EXCEPTION 'Alumni accounts cannot be org admins';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_membership_alumni BEFORE INSERT OR UPDATE OF role ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_alumni_not_admin();

CREATE TABLE public.invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           citext NOT NULL,
  invited_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  role            public.membership_role NOT NULL DEFAULT 'user',
  invited_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          public.invitation_status NOT NULL DEFAULT 'pending',
  token           text NOT NULL UNIQUE,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- Calendar
-- ----------------------------------------------------------------------------
CREATE TABLE public.events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  location_text    text,
  location         geography(Point,4326),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz,
  all_day          boolean NOT NULL DEFAULT false,
  visibility       public.event_visibility NOT NULL DEFAULT 'org',
  rrule            text,                                                -- v7: RFC 5545
  series_parent_id uuid REFERENCES public.events(id) ON DELETE CASCADE, -- v7
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.event_exceptions (  -- v7
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  occurs_on         date NOT NULL,
  is_cancelled      boolean NOT NULL DEFAULT true,
  override_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  UNIQUE (event_id, occurs_on)
);

CREATE TABLE public.event_rsvps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       public.rsvp_status NOT NULL DEFAULT 'going',
  responded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE public.calendar_feeds (  -- v7: read-only ICS export to Apple/Google
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- ----------------------------------------------------------------------------
-- Chat
-- ----------------------------------------------------------------------------
CREATE TABLE public.chats (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  type       public.chat_type NOT NULL DEFAULT 'group',
  name       text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_chats_updated BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.chat_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id      uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         public.chat_member_role NOT NULL DEFAULT 'member',
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);

CREATE TABLE public.messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body           text,
  attachment_url text,
  reply_to_id    uuid REFERENCES public.messages(id) ON DELETE SET NULL, -- v7
  created_at     timestamptz NOT NULL DEFAULT now(),
  edited_at      timestamptz,
  deleted_at     timestamptz
);

CREATE TABLE public.message_reactions (  -- v7
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- ----------------------------------------------------------------------------
-- Location
-- ----------------------------------------------------------------------------
CREATE TABLE public.location_settings (
  user_id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sharing_enabled boolean NOT NULL DEFAULT true,
  ghost_mode      boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_locset_updated BEFORE UPDATE ON public.location_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  point         geography(Point,4326) NOT NULL,
  accuracy_m    real,
  battery_level smallint,
  place_label   text,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Social feed
-- ----------------------------------------------------------------------------
CREATE TABLE public.posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        public.post_scope NOT NULL DEFAULT 'campus',
  school_id    uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  org_id       uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_anonymous boolean NOT NULL DEFAULT true,
  body         text NOT NULL,
  point        geography(Point,4326),
  score        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CHECK ((scope = 'campus' AND school_id IS NOT NULL) OR (scope = 'chapter' AND org_id IS NOT NULL))
);

CREATE TABLE public.post_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value      smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE public.comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body       text NOT NULL,
  score      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.comment_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value      smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

-- Score maintenance (v7: trigger-owned, never client-written)
CREATE OR REPLACE FUNCTION public.tg_apply_post_vote() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET score = score + NEW.value WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.posts SET score = score - OLD.value + NEW.value WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET score = score - OLD.value WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_post_votes AFTER INSERT OR UPDATE OR DELETE ON public.post_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_post_vote();

CREATE OR REPLACE FUNCTION public.tg_apply_comment_vote() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comments SET score = score + NEW.value WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.comments SET score = score - OLD.value + NEW.value WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.comments SET score = score - OLD.value WHERE id = OLD.comment_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_comment_votes AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_comment_vote();

-- ----------------------------------------------------------------------------
-- Polls (v7)
-- ----------------------------------------------------------------------------
CREATE TABLE public.polls (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  question     text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT true,
  multi_select boolean NOT NULL DEFAULT false,
  closes_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.poll_options (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id  uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label    text NOT NULL,
  position integer NOT NULL,
  UNIQUE (poll_id, position)
);

CREATE TABLE public.poll_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id  uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id, option_id)
);

CREATE OR REPLACE FUNCTION public.tg_poll_single_select() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.polls p WHERE p.id = NEW.poll_id AND p.multi_select = false)
     AND EXISTS (SELECT 1 FROM public.poll_votes v
                 WHERE v.poll_id = NEW.poll_id AND v.user_id = NEW.user_id AND v.id <> NEW.id) THEN
    RAISE EXCEPTION 'Poll is single-select';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_poll_votes_single BEFORE INSERT ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_poll_single_select();

-- ----------------------------------------------------------------------------
-- Notifications & moderation (v7)
-- ----------------------------------------------------------------------------
CREATE TABLE public.devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_token   text NOT NULL UNIQUE,
  platform     public.device_platform NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind       public.notification_kind NOT NULL,
  title      text NOT NULL,
  body       text,
  deep_link  text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_prefs (
  user_id           uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat              boolean NOT NULL DEFAULT true,
  events            boolean NOT NULL DEFAULT true,
  dues              boolean NOT NULL DEFAULT true,
  social            boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end   time,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_notifprefs_updated BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type public.report_target NOT NULL,
  target_id   uuid NOT NULL,
  reason      public.report_reason NOT NULL,
  detail      text,
  status      public.report_status NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE public.user_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- ----------------------------------------------------------------------------
-- Payments & dues (v6 domain, v7 composite-FK fix)
-- ----------------------------------------------------------------------------
CREATE TABLE public.payment_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rail           public.payment_rail NOT NULL,
  external_ref   text,
  reconcile_mode public.reconcile_mode NOT NULL DEFAULT 'webhook',
  status         public.payment_account_status NOT NULL DEFAULT 'pending',
  is_mandated    boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, rail),
  UNIQUE (org_id, id)   -- v7: composite-FK target for same-org routing
);
CREATE TRIGGER trg_payacct_updated BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.dues_cycles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  scope                public.dues_scope NOT NULL DEFAULT 'all',
  default_amount_cents integer CHECK (default_amount_cents >= 0),
  due_date             date,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.charges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dues_cycle_id      uuid REFERENCES public.dues_cycles(id) ON DELETE SET NULL,
  payment_account_id uuid NOT NULL,
  category           public.charge_category NOT NULL,
  description        text,
  amount_cents       integer NOT NULL CHECK (amount_cents >= 0),
  due_date           date,
  status             public.charge_status NOT NULL DEFAULT 'unpaid',
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- v7: a charge can only route to its own org's rail
  FOREIGN KEY (org_id, payment_account_id)
    REFERENCES public.payment_accounts (org_id, id) ON DELETE RESTRICT
);

-- v7: national dues must route to the org's mandated rail
CREATE OR REPLACE FUNCTION public.tg_charges_route() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_mandated boolean;
BEGIN
  SELECT pa.is_mandated INTO v_mandated
    FROM public.payment_accounts pa WHERE pa.id = NEW.payment_account_id;
  IF NEW.category = 'national_dues' AND NOT COALESCE(v_mandated, false)
     AND EXISTS (SELECT 1 FROM public.payment_accounts pa2
                 WHERE pa2.org_id = NEW.org_id AND pa2.is_mandated AND pa2.is_active) THEN
    RAISE EXCEPTION 'national_dues must route to the org''s mandated payment account';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_charges_route BEFORE INSERT OR UPDATE OF category, payment_account_id
  ON public.charges
  FOR EACH ROW EXECUTE FUNCTION public.tg_charges_route();

CREATE TABLE public.payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id              uuid NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  org_id                 uuid NOT NULL,   -- v7: denormalized for composite FK, trigger-set
  user_id                uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_account_id     uuid NOT NULL,
  channel                public.payment_channel NOT NULL,
  gross_cents            integer NOT NULL CHECK (gross_cents >= 0),
  processor_fee_cents    integer NOT NULL DEFAULT 0,
  application_fee_cents  integer NOT NULL DEFAULT 0,
  net_cents              integer NOT NULL,
  external_ref           text,
  status                 public.payment_status NOT NULL DEFAULT 'pending',
  reconciliation_source  public.reconciliation_source,
  paid_at                timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (net_cents = gross_cents - processor_fee_cents - application_fee_cents),
  FOREIGN KEY (org_id, payment_account_id)
    REFERENCES public.payment_accounts (org_id, id) ON DELETE RESTRICT
);

-- v7: set payments.org_id from the charge; app fee only on stripe_connect
CREATE OR REPLACE FUNCTION public.tg_payments_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_org uuid; v_rail public.payment_rail;
BEGIN
  SELECT c.org_id INTO v_org FROM public.charges c WHERE c.id = NEW.charge_id;
  NEW.org_id := v_org;
  SELECT pa.rail INTO v_rail FROM public.payment_accounts pa WHERE pa.id = NEW.payment_account_id;
  IF NEW.application_fee_cents > 0 AND v_rail <> 'stripe_connect' THEN
    RAISE EXCEPTION 'Application fee only allowed on the stripe_connect rail';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payments_guard BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payments_guard();

-- Keep charges.status in sync with succeeded payments
CREATE OR REPLACE FUNCTION public.tg_settle_charge() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_charge uuid; v_amount integer; v_paid integer; v_status public.charge_status;
BEGIN
  v_charge := COALESCE(NEW.charge_id, OLD.charge_id);
  SELECT amount_cents, status INTO v_amount, v_status FROM public.charges WHERE id = v_charge;
  IF v_status IN ('waived', 'void') THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(gross_cents), 0) INTO v_paid
    FROM public.payments WHERE charge_id = v_charge AND status = 'succeeded';
  UPDATE public.charges SET status =
    CASE WHEN v_paid >= v_amount THEN 'paid'::public.charge_status
         WHEN v_paid > 0 THEN 'partial'::public.charge_status
         ELSE 'unpaid'::public.charge_status END
  WHERE id = v_charge;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_settle_charge AFTER INSERT OR UPDATE OF status OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_settle_charge();

CREATE TABLE public.payment_methods (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_account_id uuid NOT NULL REFERENCES public.payment_accounts(id) ON DELETE CASCADE,
  processor_token    text NOT NULL,
  type               public.instrument_type NOT NULL,
  brand              text,
  last4              text,
  is_default         boolean NOT NULL DEFAULT false,
  autopay_enabled    boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_payment_methods_default
  ON public.payment_methods (user_id, payment_account_id) WHERE (is_default);

CREATE TABLE public.payment_plans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id          uuid NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  schedule           public.plan_schedule NOT NULL DEFAULT 'full',
  installments_total integer NOT NULL DEFAULT 1 CHECK (installments_total >= 1),
  status             public.plan_status NOT NULL DEFAULT 'active',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.installments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  payment_id   uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  seq_no       integer NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  due_date     date NOT NULL,
  status       public.installment_status NOT NULL DEFAULT 'scheduled',
  UNIQUE (plan_id, seq_no)
);

CREATE TABLE public.platform_fees (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id            uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  application_fee_cents integer NOT NULL,
  connect_cost_cents    integer NOT NULL DEFAULT 0,
  net_revenue_cents     integer NOT NULL,
  period                text,
  payout_status         public.payout_status NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (net_revenue_cents = application_fee_cents - connect_cost_cents)
);

CREATE TABLE public.reconciliation_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  source      public.reconciliation_source NOT NULL,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  external_ref text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Indexes (v7 index plan)
-- ----------------------------------------------------------------------------
CREATE INDEX idx_school_domains_school   ON public.school_domains (school_id);
CREATE INDEX idx_profiles_school         ON public.profiles (school_id);
CREATE INDEX idx_affiliations_user       ON public.school_affiliations (user_id);
CREATE INDEX idx_affiliations_school     ON public.school_affiliations (school_id);
CREATE INDEX idx_orgs_school             ON public.organizations (school_id);
CREATE INDEX idx_memberships_user        ON public.memberships (user_id);
CREATE INDEX idx_memberships_org_status  ON public.memberships (org_id, status);
CREATE INDEX idx_invitations_org         ON public.invitations (org_id);
CREATE INDEX idx_invitations_email       ON public.invitations (email);
CREATE INDEX idx_events_org_starts       ON public.events (org_id, starts_at);
CREATE INDEX idx_events_series           ON public.events (series_parent_id) WHERE series_parent_id IS NOT NULL;
CREATE INDEX idx_event_rsvps_user        ON public.event_rsvps (user_id);
CREATE INDEX idx_chats_org               ON public.chats (org_id);
CREATE INDEX idx_chat_members_user       ON public.chat_members (user_id);
CREATE INDEX idx_messages_chat_created   ON public.messages (chat_id, created_at DESC);
CREATE INDEX idx_locations_user_captured ON public.locations (user_id, captured_at DESC);
CREATE INDEX idx_locations_point_gist    ON public.locations USING gist (point);
CREATE INDEX idx_events_location_gist    ON public.events USING gist (location);
CREATE INDEX idx_posts_point_gist        ON public.posts USING gist (point);
CREATE INDEX idx_schools_location_gist   ON public.schools USING gist (location);
CREATE INDEX idx_posts_school_created    ON public.posts (school_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_org_created       ON public.posts (org_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_post           ON public.comments (post_id);
CREATE INDEX idx_polls_org               ON public.polls (org_id);
CREATE INDEX idx_devices_user            ON public.devices (user_id);
CREATE INDEX idx_notifications_unread    ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX idx_reports_open            ON public.reports (status) WHERE status = 'open';
CREATE INDEX idx_charges_org_open        ON public.charges (org_id) WHERE status IN ('unpaid','partial');
CREATE INDEX idx_charges_user            ON public.charges (user_id);
CREATE INDEX idx_payments_charge         ON public.payments (charge_id);
CREATE INDEX idx_payment_methods_user    ON public.payment_methods (user_id);
CREATE INDEX idx_installments_plan       ON public.installments (plan_id);
