-- stream_contacts.category was NOT NULL but ~110 historical contacts have no
-- mappable category (Sponsor, WPP staff, Crew, Artist, etc.). Make nullable so
-- they can be imported and categorised manually later.
ALTER TABLE stream_contacts ALTER COLUMN category DROP NOT NULL;
