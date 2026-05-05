-- =============================================================================
-- Migration: 0006_unify
-- Merges the parallel Stream system into the single unified contacts/events model.
--
-- stream_contacts         → contacts   (org_id nullable, stream fields added)
-- event_years             → events     (is_current added)
-- event_year_participations → event_invitees  (richer enums, stream fields added)
-- participation_agencies  → re-pointed to event_invitees
--
-- event_invite_status and event_rsvp_status enums are dropped and replaced by
-- the richer invite_status and rsvp_status enums from the stream schema.
-- Safe because event_invitees had zero rows at time of migration.
--
-- Wrapped in a transaction — partial execution leaves the DB unchanged.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extend contacts
-- ---------------------------------------------------------------------------

ALTER TABLE contacts ALTER COLUMN org_id DROP NOT NULL;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company         text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category        contact_category;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city            text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country         text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS gender          gender;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS race            race;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assistant_email citext;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile_number   text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url    text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at      timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- Temp column to carry stream_contacts.id through the migration
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS _stream_contact_id uuid;

-- ---------------------------------------------------------------------------
-- 2. Extend events
-- ---------------------------------------------------------------------------

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

-- At most one current event at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_current_event
  ON events (is_current) WHERE is_current = true;

-- Temp column to carry event_years.id through the migration
ALTER TABLE events ADD COLUMN IF NOT EXISTS _event_year_id uuid;

-- ---------------------------------------------------------------------------
-- 3. Extend event_invitees with stream participation fields
--    (safe before the enum swap because the table is empty)
-- ---------------------------------------------------------------------------

ALTER TABLE event_invitees ADD COLUMN IF NOT EXISTS nominated             boolean NOT NULL DEFAULT false;
ALTER TABLE event_invitees ADD COLUMN IF NOT EXISTS priority              priority_flag;
ALTER TABLE event_invitees ADD COLUMN IF NOT EXISTS nominating_agency_id  uuid REFERENCES agencies(id);
ALTER TABLE event_invitees ADD COLUMN IF NOT EXISTS nominator             text;
ALTER TABLE event_invitees ADD COLUMN IF NOT EXISTS comments              text;

-- ---------------------------------------------------------------------------
-- 4. Swap event_invitees enum columns from the thin generic enums to the
--    richer stream enums.  Zero rows → no USING data cast needed.
-- ---------------------------------------------------------------------------

ALTER TABLE event_invitees ALTER COLUMN invite_status DROP DEFAULT;
ALTER TABLE event_invitees ALTER COLUMN rsvp_status   DROP DEFAULT;

ALTER TABLE event_invitees
  ALTER COLUMN invite_status TYPE invite_status
  USING invite_status::text::invite_status;

ALTER TABLE event_invitees
  ALTER COLUMN rsvp_status TYPE rsvp_status
  USING rsvp_status::text::rsvp_status;

-- Both nullable — stream participations allow NULL on these
ALTER TABLE event_invitees ALTER COLUMN invite_status DROP NOT NULL;
ALTER TABLE event_invitees ALTER COLUMN rsvp_status   DROP NOT NULL;

DROP INDEX IF EXISTS event_invitees_invite_status_idx;
DROP INDEX IF EXISTS event_invitees_rsvp_status_idx;
CREATE INDEX IF NOT EXISTS event_invitees_invite_status_idx ON event_invitees (event_id, invite_status);
CREATE INDEX IF NOT EXISTS event_invitees_rsvp_status_idx   ON event_invitees (event_id, rsvp_status);

-- ---------------------------------------------------------------------------
-- 5. Migrate stream_contacts → contacts
--    stream_contacts.position → contacts.title
--    stream_contacts.email is citext; contacts.email is text
-- ---------------------------------------------------------------------------

INSERT INTO contacts (
  first_name, last_name,
  org_id,
  title,
  email,
  company,
  category,
  city,
  country,
  gender,
  race,
  assistant_email,
  mobile_number,
  linkedin_url,
  deleted_at,
  created_at,
  updated_at,
  _stream_contact_id
)
SELECT
  sc.first_name,
  sc.last_name,
  NULL,
  sc.position,
  sc.email::text,
  sc.company,
  sc.category,
  sc.city,
  sc.country,
  sc.gender,
  sc.race,
  sc.assistant_email,
  sc.mobile_number,
  sc.linkedin_url,
  sc.deleted_at,
  sc.created_at,
  sc.updated_at,
  sc.id
FROM stream_contacts sc
WHERE sc.id NOT IN (
  SELECT _stream_contact_id FROM contacts WHERE _stream_contact_id IS NOT NULL
);

-- Wire the set_updated_at trigger onto contacts (function exists from 0002)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'contacts_updated_at'
      AND tgrelid = 'contacts'::regclass
  ) THEN
    EXECUTE $trig$
      CREATE TRIGGER contacts_updated_at
        BEFORE UPDATE ON contacts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    $trig$;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Migrate event_years → events
-- ---------------------------------------------------------------------------

INSERT INTO events (name, is_current, is_active, created_at, updated_at, _event_year_id)
SELECT
  'WPP Stream ' || ey.year,
  ey.is_current,
  true,
  ey.created_at,
  ey.updated_at,
  ey.id
FROM event_years ey
WHERE ey.id NOT IN (
  SELECT _event_year_id FROM events WHERE _event_year_id IS NOT NULL
);

-- ---------------------------------------------------------------------------
-- 7. Migrate event_year_participations → event_invitees
--    eyp.comments → event_invitees.notes
-- ---------------------------------------------------------------------------

INSERT INTO event_invitees (
  event_id,
  contact_id,
  invite_status,
  rsvp_status,
  nominated,
  priority,
  nominating_agency_id,
  nominator,
  notes,
  created_at,
  updated_at
)
SELECT
  e.id,
  c.id,
  eyp.invite_status,
  eyp.rsvp_status,
  eyp.nominated,
  eyp.priority,
  eyp.nominating_agency_id,
  eyp.nominator,
  eyp.comments,
  eyp.created_at,
  eyp.updated_at
FROM event_year_participations eyp
JOIN events   e ON e._event_year_id     = eyp.event_year_id
JOIN contacts c ON c._stream_contact_id = eyp.contact_id
WHERE NOT EXISTS (
  SELECT 1 FROM event_invitees ei
  WHERE ei.event_id   = e.id
    AND ei.contact_id = c.id
);

-- ---------------------------------------------------------------------------
-- 8. Re-point participation_agencies FK:
--    old: event_year_participations.id
--    new: event_invitees.id
-- ---------------------------------------------------------------------------

ALTER TABLE participation_agencies
  ADD COLUMN IF NOT EXISTS _old_participation_id uuid;

-- Snapshot old value before we overwrite participation_id
UPDATE participation_agencies
   SET _old_participation_id = participation_id
 WHERE _old_participation_id IS NULL;

ALTER TABLE participation_agencies
  DROP CONSTRAINT IF EXISTS participation_agencies_participation_id_fkey;

-- Map to new event_invitees.id
UPDATE participation_agencies pa
   SET participation_id = ei.id
  FROM event_year_participations eyp
  JOIN events   e ON e._event_year_id     = eyp.event_year_id
  JOIN contacts c ON c._stream_contact_id = eyp.contact_id
  JOIN event_invitees ei
       ON ei.event_id   = e.id
      AND ei.contact_id = c.id
 WHERE pa._old_participation_id = eyp.id;

-- Remove any rows that couldn't be re-mapped (orphaned data)
DELETE FROM participation_agencies WHERE participation_id = _old_participation_id;

ALTER TABLE participation_agencies
  ADD CONSTRAINT participation_agencies_participation_id_fkey
  FOREIGN KEY (participation_id)
  REFERENCES event_invitees(id)
  ON DELETE CASCADE;

ALTER TABLE participation_agencies DROP COLUMN IF EXISTS _old_participation_id;

-- ---------------------------------------------------------------------------
-- 9. Drop views that reference stream tables
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS v_current_year_demographics;
DROP VIEW IF EXISTS v_current_year_invite_allocation;
DROP VIEW IF EXISTS v_current_year_rsvp_status;

-- ---------------------------------------------------------------------------
-- 10. Drop stream tables (now superseded)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS event_year_participations;
DROP TABLE IF EXISTS event_years;
DROP TABLE IF EXISTS stream_contacts;

-- ---------------------------------------------------------------------------
-- 11. Drop the two thin generic enums (replaced by stream enums)
-- ---------------------------------------------------------------------------

DROP TYPE IF EXISTS event_invite_status;
DROP TYPE IF EXISTS event_rsvp_status;

-- ---------------------------------------------------------------------------
-- 12. Clean up temp columns and their indexes
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS contacts_stream_contact_id_idx;
ALTER TABLE contacts  DROP COLUMN IF EXISTS _stream_contact_id;

DROP INDEX IF EXISTS events_event_year_id_idx;
ALTER TABLE events DROP COLUMN IF EXISTS _event_year_id;

-- ---------------------------------------------------------------------------
-- 13. New indexes for stream fields on contacts
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS contacts_category_idx ON contacts (category)           WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_company_idx  ON contacts (company)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_name_idx     ON contacts (last_name, first_name);

COMMIT;
