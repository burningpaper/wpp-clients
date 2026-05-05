-- =============================================================================
-- Migration: 0003_events
-- Generic event management — events + invitees from main contacts DB
-- Requires 0002_stream to have run (set_updated_at function must exist)
-- =============================================================================

CREATE TYPE event_invite_status AS ENUM (
  'not_invited',
  'invited',
  'waitlisted',
  'declined'
);

CREATE TYPE event_rsvp_status AS ENUM (
  'pending',
  'confirmed',
  'declined',
  'attended',
  'no_show'
);

CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  venue       text,
  event_date  date,
  capacity    integer,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_date_idx ON events (event_date);

CREATE TABLE event_invitees (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contact_id     uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  invite_status  event_invite_status NOT NULL DEFAULT 'not_invited',
  rsvp_status    event_rsvp_status   NOT NULL DEFAULT 'pending',
  notes          text,
  invited_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_invitees_unique UNIQUE (event_id, contact_id)
);

CREATE INDEX event_invitees_event_idx         ON event_invitees (event_id);
CREATE INDEX event_invitees_contact_idx       ON event_invitees (contact_id);
CREATE INDEX event_invitees_invite_status_idx ON event_invitees (event_id, invite_status);
CREATE INDEX event_invitees_rsvp_status_idx   ON event_invitees (event_id, rsvp_status);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER event_invitees_updated_at
  BEFORE UPDATE ON event_invitees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
