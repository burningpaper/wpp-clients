-- =============================================================================
-- Migration: 0002_stream
-- Adds Stream event management tables, enums, views, triggers, and seed data
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Extend agencies with active flag and updated_at
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- =============================================================================
-- Enums
-- =============================================================================

CREATE TYPE contact_category AS ENUM (
  'client_sa',
  'client_africa',
  'client_global',
  'industry_sa',
  'industry_africa',
  'industry_global',
  'agency_sa',
  'agency_africa',
  'agency_global',
  'rising_star'
);

CREATE TYPE gender AS ENUM ('male', 'female', 'unknown');

-- SA Employment Equity categories; confirm with data owner before finalising
CREATE TYPE race AS ENUM ('african', 'coloured', 'indian', 'white', 'other');

CREATE TYPE invite_status AS ENUM (
  'first_round_invite',
  'second_round_invite',
  'third_round_invite',
  'agency_invite',
  'rising_star_invite',
  'waiting_list',
  'other_invite',
  'no'
);

CREATE TYPE rsvp_status AS ENUM (
  'pending',
  'bounced',
  'error',
  'accepted',
  'declined',
  'cancelled',
  'no_show',
  'accepted_on_their_behalf'
);

CREATE TYPE priority_flag AS ENUM ('yes', 'other');

-- =============================================================================
-- stream_contacts
-- =============================================================================

CREATE TABLE stream_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        contact_category NOT NULL,
  company         text,
  position        text,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  city            text,
  country         text,
  gender          gender,
  race            race,
  email           citext,
  assistant_email citext,
  mobile_number   text,
  linkedin_url    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT stream_contacts_email_format
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT stream_contacts_assistant_email_format
    CHECK (assistant_email IS NULL OR assistant_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Unique email among non-deleted contacts only
CREATE UNIQUE INDEX stream_contacts_email_unique
  ON stream_contacts (email) WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX stream_contacts_category_idx ON stream_contacts (category) WHERE deleted_at IS NULL;
CREATE INDEX stream_contacts_company_idx  ON stream_contacts (company)  WHERE deleted_at IS NULL;
CREATE INDEX stream_contacts_country_idx  ON stream_contacts (country)  WHERE deleted_at IS NULL;
CREATE INDEX stream_contacts_name_idx     ON stream_contacts (last_name, first_name) WHERE deleted_at IS NULL;

-- =============================================================================
-- event_years
-- =============================================================================

CREATE TABLE event_years (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  year       integer NOT NULL UNIQUE,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one current event year at any time
CREATE UNIQUE INDEX one_current_event_year
  ON event_years (is_current) WHERE is_current = true;

-- =============================================================================
-- event_year_participations
-- =============================================================================

CREATE TABLE event_year_participations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            uuid NOT NULL REFERENCES stream_contacts(id) ON DELETE CASCADE,
  event_year_id         uuid NOT NULL REFERENCES event_years(id) ON DELETE RESTRICT,
  nominated             boolean NOT NULL DEFAULT false,
  priority              priority_flag,
  nominating_agency_id  uuid REFERENCES agencies(id),
  nominator             text,
  invite_status         invite_status,
  rsvp_status           rsvp_status,
  comments              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participation_unique_per_year UNIQUE (contact_id, event_year_id)
);

CREATE INDEX participations_year_idx          ON event_year_participations (event_year_id);
CREATE INDEX participations_contact_idx       ON event_year_participations (contact_id);
CREATE INDEX participations_invite_status_idx ON event_year_participations (event_year_id, invite_status);
CREATE INDEX participations_rsvp_status_idx   ON event_year_participations (event_year_id, rsvp_status);

-- =============================================================================
-- Trigger: auto-update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER event_years_updated_at
  BEFORE UPDATE ON event_years
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER stream_contacts_updated_at
  BEFORE UPDATE ON stream_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER participations_updated_at
  BEFORE UPDATE ON event_year_participations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Reporting views (current year only)
-- =============================================================================

CREATE OR REPLACE VIEW v_current_year_demographics AS
SELECT
  ey.year,
  c.category,
  c.gender,
  c.race,
  COUNT(*) AS contact_count
FROM event_year_participations p
JOIN stream_contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
JOIN event_years ey    ON ey.id = p.event_year_id AND ey.is_current = true
GROUP BY ey.year, c.category, c.gender, c.race
ORDER BY c.category, c.gender, c.race;

CREATE OR REPLACE VIEW v_current_year_invite_allocation AS
SELECT
  ey.year,
  c.category,
  p.invite_status,
  COUNT(*) AS contact_count
FROM event_year_participations p
JOIN stream_contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
JOIN event_years ey    ON ey.id = p.event_year_id AND ey.is_current = true
WHERE p.invite_status IS NOT NULL
GROUP BY ey.year, c.category, p.invite_status
ORDER BY c.category, p.invite_status;

CREATE OR REPLACE VIEW v_current_year_rsvp_status AS
SELECT
  ey.year,
  c.category,
  p.rsvp_status,
  COUNT(*) AS contact_count
FROM event_year_participations p
JOIN stream_contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
JOIN event_years ey    ON ey.id = p.event_year_id AND ey.is_current = true
WHERE p.rsvp_status IS NOT NULL
GROUP BY ey.year, c.category, p.rsvp_status
ORDER BY c.category, p.rsvp_status;

-- =============================================================================
-- Seed: agencies (2026 Stream dropdown list)
-- =============================================================================

INSERT INTO agencies (name, active) VALUES
  ('AKQA',                       true),
  ('Algorithm Media',            true),
  ('Barrows',                    true),
  ('Burson',                     true),
  ('DataOrbis',                  true),
  ('Design Bridge and Partners', true),
  ('WPP Media',                  true),
  ('WPP Production',             true),
  ('Open X',                     true),
  ('Ogilvy SA',                  true),
  ('Ogilvy Africa',              true),
  ('Scangroup',                  true),
  ('WPP',                        true),
  ('VML',                        true),
  ('VML Data',                   true),
  ('Yonder',                     true)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Seed: event years 2022–2026 (2026 marked as current)
-- =============================================================================

INSERT INTO event_years (year, is_current) VALUES
  (2022, false),
  (2023, false),
  (2024, false),
  (2025, false),
  (2026, true)
ON CONFLICT (year) DO NOTHING;
