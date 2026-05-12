ALTER TABLE event_invitees ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false;
