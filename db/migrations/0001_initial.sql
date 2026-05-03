-- WPP SA Client Contact & Intelligence Database
-- Initial migration

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "role" AS ENUM ('account_director', 'ceo_md', 'system_admin');
CREATE TYPE "relationship_strength" AS ENUM ('cold', 'warm', 'strong');
CREATE TYPE "note_type" AS ENUM ('meeting', 'news', 'budget_signal', 'relationship', 'risk');
CREATE TYPE "visibility" AS ENUM ('wpp_sa', 'agency_only');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE "agencies" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "users" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"       TEXT NOT NULL UNIQUE,
  "name"        TEXT,
  "agency_id"   UUID REFERENCES "agencies"("id"),
  "role"        "role" NOT NULL DEFAULT 'account_director',
  "is_champion" BOOLEAN NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "users_email_idx" ON "users"("email");

CREATE TABLE "organisations" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "contacts" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "first_name"   TEXT NOT NULL,
  "last_name"    TEXT NOT NULL,
  "org_id"       UUID NOT NULL REFERENCES "organisations"("id"),
  "title"        TEXT,
  "email"        TEXT,
  "last_updated" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "contact_agency_relationships" (
  "contact_id"           UUID NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "agency_id"            UUID NOT NULL REFERENCES "agencies"("id"),
  "relationship_strength" "relationship_strength" NOT NULL,
  "last_contact_date"    TIMESTAMPTZ,
  "relationship_owner_id" UUID REFERENCES "users"("id"),
  PRIMARY KEY ("contact_id", "agency_id")
);

CREATE INDEX "car_agency_strength_idx" ON "contact_agency_relationships"("agency_id", "relationship_strength");

-- Trigger: keep contacts.last_updated current on any write to contacts or contact_agency_relationships

CREATE OR REPLACE FUNCTION update_contact_last_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'contacts' THEN
    NEW.last_updated = now();
    RETURN NEW;
  ELSE
    -- contact_agency_relationships
    UPDATE contacts SET last_updated = now() WHERE id = NEW.contact_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER contacts_last_updated
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_contact_last_updated();

CREATE TRIGGER car_touch_contact
  AFTER INSERT OR UPDATE ON contact_agency_relationships
  FOR EACH ROW EXECUTE FUNCTION update_contact_last_updated();

-- ---------------------------------------------------------------------------
-- Intelligence notes
-- ---------------------------------------------------------------------------

CREATE TABLE "intelligence_notes" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "contact_id"            UUID REFERENCES "contacts"("id") ON DELETE CASCADE,
  "org_id"                UUID REFERENCES "organisations"("id") ON DELETE CASCADE,
  "note_type"             "note_type" NOT NULL,
  "body"                  TEXT NOT NULL,
  "body_tsv"              TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', body)) STORED,
  "visibility"            "visibility" NOT NULL DEFAULT 'wpp_sa',
  "created_by_agency_id"  UUID NOT NULL REFERENCES "agencies"("id"),
  "created_by_user_id"    UUID NOT NULL REFERENCES "users"("id"),
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "note_exactly_one_target"
    CHECK (
      (contact_id IS NOT NULL AND org_id IS NULL)
      OR
      (contact_id IS NULL AND org_id IS NOT NULL)
    )
);

CREATE INDEX "notes_body_fts_idx" ON "intelligence_notes" USING GIN ("body_tsv");
CREATE INDEX "notes_contact_idx" ON "intelligence_notes"("contact_id");
CREATE INDEX "notes_org_idx"     ON "intelligence_notes"("org_id");

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

CREATE TABLE "tags" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "contact_tags" (
  "contact_id" UUID NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "tag_id"     UUID NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("contact_id", "tag_id")
);

CREATE TABLE "org_tags" (
  "org_id"  UUID NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "tag_id"  UUID NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("org_id", "tag_id")
);

-- ---------------------------------------------------------------------------
-- Seed: WPP SA agencies
-- ---------------------------------------------------------------------------

INSERT INTO "agencies" ("name") VALUES
  ('Ogilvy'),
  ('GroupM'),
  ('Grey'),
  ('Wunderman Thompson'),
  ('VMLY&R'),
  ('Mindshare'),
  ('MediaCom');
