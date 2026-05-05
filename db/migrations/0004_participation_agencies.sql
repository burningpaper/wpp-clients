-- =============================================================================
-- Migration: 0004_participation_agencies
-- Adds participation_agencies junction table linking event_year_participations
-- to the agencies that nominated a contact. Supports the historical CSV import
-- (participation_agencies.csv) where a single participation can be attributed
-- to one or more agencies, with one marked as primary.
-- =============================================================================

CREATE TABLE participation_agencies (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id uuid        NOT NULL REFERENCES event_year_participations(id) ON DELETE CASCADE,
  agency_name      text        NOT NULL,
  is_primary       boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX participation_agencies_participation_idx
  ON participation_agencies (participation_id);
