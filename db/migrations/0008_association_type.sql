-- Add association_type enum (idempotent — no IF NOT EXISTS for CREATE TYPE)
DO $$ BEGIN
  CREATE TYPE association_type AS ENUM ('client_of', 'ex_client_of', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add nullable association_type column to contact_agency_relationships
ALTER TABLE contact_agency_relationships
  ADD COLUMN IF NOT EXISTS association_type association_type;

-- Data migration: seed 'client_of' associations from WPP Stream 2026 participation data.
-- Source: participation_agencies joined to event_invitees for WPP Stream 2026 event.
-- Exclude any agency whose name contains 'WPP' (case-insensitive).
-- Match participation agency names to agencies table by lower-cased name.
-- ON CONFLICT: preserve any existing association_type; only set it when currently NULL.
INSERT INTO contact_agency_relationships (contact_id, agency_id, relationship_strength, association_type)
SELECT DISTINCT
  ei.contact_id,
  a.id,
  'cold'::relationship_strength,
  'client_of'::association_type
FROM event_invitees ei
JOIN participation_agencies pa ON pa.participation_id = ei.id
JOIN agencies a ON lower(a.name) = lower(pa.agency_name)
WHERE ei.event_id IN (
  SELECT id FROM events WHERE name ILIKE '%Stream 2026%'
)
  AND pa.agency_name NOT ILIKE '%WPP%'
ON CONFLICT (contact_id, agency_id) DO UPDATE
  SET association_type = COALESCE(
    contact_agency_relationships.association_type,
    EXCLUDED.association_type
  );
