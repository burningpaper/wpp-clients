# Stream Contact Database — Specification

## Purpose

A contact and nomination management database for the annual **Stream** event. Tracks contacts (clients, industry figures, agency people, rising stars) across multiple geographies, and records each contact's nomination, invitation, and RSVP status year by year. Supports reporting on demographic mix, invite allocation, and RSVP outcomes.

## Stack

- **Database:** PostgreSQL 15+ (compatible with Neon)
- **Naming:** `snake_case` for all identifiers
- **Keys:** UUID primary keys (`gen_random_uuid()`); enable `pgcrypto` if not already
- **Timestamps:** `created_at` and `updated_at` (`timestamptz`) on every table; trigger to auto-update `updated_at`
- **Soft delete:** `deleted_at timestamptz NULL` on `contacts` only

---

## Design notes

### 1. Year data is normalised, not columnar

The source spreadsheet repeats fields per year (`2022 Status`, `2023 RSVP Status`, `2024 Nominating Agency`, etc.). Modelling these as columns means every new event year requires a schema migration and breaks pivot reporting. Instead:

- One row per **(contact, event year)** in `event_year_participations`
- Adding 2027 is a single insert into `event_years`, not a migration
- Pivots become trivial `GROUP BY` queries

### 2. Nominating agencies are a lookup, not an enum

Agencies change over time (mergers, rebrands, new entrants). The 2026 dropdown lists 16 agencies; assume this drifts. Lookup table with an `active` flag.

### 3. Categories, statuses, RSVP states are enums

These are stable, short, and used for filtering/grouping. Postgres native enums — fast, indexable, and self-documenting at the schema level.

### 4. Email validation at DB level

Source spec says invalid emails should be rejected. Use a `CHECK` constraint with a regex rather than relying on application-layer validation alone.

### 5. Race field — flagged for review

The source lists only `White, Colour` for the `race` field. South African employment-equity reporting standard categories are `African, Coloured, Indian, White, Other`. The schema below uses the standard set; **confirm with the data owner** before finalising. Field is nullable.

---

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;         -- case-insensitive email
```

---

## Enums

```sql
CREATE TYPE contact_category AS ENUM (
  'client_sa', 'client_africa', 'client_global',
  'industry_sa', 'industry_africa', 'industry_global',
  'agency_sa', 'agency_africa', 'agency_global',
  'rising_star'
);

CREATE TYPE gender AS ENUM ('male', 'female', 'unknown');

-- Confirm with data owner before finalising
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
```

---

## Tables

### `agencies`

Nominating agencies. Lookup table because the list changes year to year.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `name` | `text` NOT NULL UNIQUE | e.g. "VML", "Ogilvy SA" |
| `active` | `boolean` NOT NULL DEFAULT `true` | Set false rather than deleting |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Seed data** (from 2026 dropdown):
AKQA, Algorithm Media, Barrows, Burson, DataOrbis, Design Bridge and Partners, WPP Media, WPP Production, Open X, Ogilvy SA, Ogilvy Africa, Scangroup, WPP, VML, VML Data, Yonder.

---

### `event_years`

One row per year the event runs.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `year` | `integer` NOT NULL UNIQUE | e.g. 2026 |
| `is_current` | `boolean` NOT NULL DEFAULT `false` | Only one row should be true; enforce with partial unique index |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

```sql
CREATE UNIQUE INDEX one_current_event_year
  ON event_years (is_current) WHERE is_current = true;
```

**Seed data:** rows for 2022, 2023, 2024, 2025, 2026 (mark 2026 as current).

---

### `contacts`

The core entity — one row per person.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `category` | `contact_category` NOT NULL | |
| `company` | `text` | |
| `position` | `text` | |
| `first_name` | `text` NOT NULL | |
| `last_name` | `text` NOT NULL | |
| `city` | `text` | |
| `country` | `text` | ISO 3166 country name; consider FK to a countries table later |
| `gender` | `gender` | |
| `race` | `race` | See design note 5 |
| `email` | `citext` | UNIQUE when not null; validated by CHECK |
| `assistant_email` | `citext` | Validated by CHECK |
| `mobile_number` | `text` | E.164 format recommended (`+27...`); store as text not integer |
| `linkedin_url` | `text` | |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `deleted_at` | `timestamptz` | Soft delete |

**Constraints:**

```sql
-- Email format validation (RFC 5322-ish, pragmatic)
ALTER TABLE contacts ADD CONSTRAINT contacts_email_format
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE contacts ADD CONSTRAINT contacts_assistant_email_format
  CHECK (assistant_email IS NULL OR assistant_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Email unique among non-deleted contacts
CREATE UNIQUE INDEX contacts_email_unique
  ON contacts (email) WHERE email IS NOT NULL AND deleted_at IS NULL;
```

**Indexes:**

```sql
CREATE INDEX contacts_category_idx ON contacts (category) WHERE deleted_at IS NULL;
CREATE INDEX contacts_company_idx ON contacts (company) WHERE deleted_at IS NULL;
CREATE INDEX contacts_country_idx ON contacts (country) WHERE deleted_at IS NULL;
CREATE INDEX contacts_name_idx ON contacts (last_name, first_name) WHERE deleted_at IS NULL;
```

---

### `event_year_participations`

The per-year nomination/invite/RSVP record. One row per (contact, year).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `contact_id` | `uuid` NOT NULL REFERENCES `contacts(id)` ON DELETE CASCADE | |
| `event_year_id` | `uuid` NOT NULL REFERENCES `event_years(id)` ON DELETE RESTRICT | |
| `nominated` | `boolean` NOT NULL DEFAULT `false` | Source's "2026 Nomination: Yes" |
| `priority` | `priority_flag` | NULL = blank in source |
| `nominating_agency_id` | `uuid` REFERENCES `agencies(id)` | |
| `nominator` | `text` | Free-text nominator name |
| `invite_status` | `invite_status` | |
| `rsvp_status` | `rsvp_status` | |
| `comments` | `text` | "Comments/Actions" field |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Constraints:**

```sql
ALTER TABLE event_year_participations
  ADD CONSTRAINT participation_unique_per_year
  UNIQUE (contact_id, event_year_id);
```

**Indexes:**

```sql
CREATE INDEX participations_year_idx ON event_year_participations (event_year_id);
CREATE INDEX participations_contact_idx ON event_year_participations (contact_id);
CREATE INDEX participations_invite_status_idx ON event_year_participations (event_year_id, invite_status);
CREATE INDEX participations_rsvp_status_idx ON event_year_participations (event_year_id, rsvp_status);
```

---

## Trigger: auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table:
CREATE TRIGGER agencies_updated_at BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER event_years_updated_at BEFORE UPDATE ON event_years
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER participations_updated_at BEFORE UPDATE ON event_year_participations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Reporting views

Source spec requires three pivots **for the current year**: demographic/gender split, invite allocation, and RSVP status. Build as views so they're always live.

### `v_current_year_demographics`

Gender × race × category, current year only.

```sql
CREATE OR REPLACE VIEW v_current_year_demographics AS
SELECT
  ey.year,
  c.category,
  c.gender,
  c.race,
  COUNT(*) AS contact_count
FROM event_year_participations p
JOIN contacts c        ON c.id = p.contact_id AND c.deleted_at IS NULL
JOIN event_years ey    ON ey.id = p.event_year_id AND ey.is_current = true
GROUP BY ey.year, c.category, c.gender, c.race
ORDER BY c.category, c.gender, c.race;
```

### `v_current_year_invite_allocation`

Invite status split by category.

```sql
CREATE OR REPLACE VIEW v_current_year_invite_allocation AS
SELECT
  ey.year,
  c.category,
  p.invite_status,
  COUNT(*) AS contact_count
FROM event_year_participations p
JOIN contacts c        ON c.id = p.contact_id AND c.deleted_at IS NULL
JOIN event_years ey    ON ey.id = p.event_year_id AND ey.is_current = true
WHERE p.invite_status IS NOT NULL
GROUP BY ey.year, c.category, p.invite_status
ORDER BY c.category, p.invite_status;
```

### `v_current_year_rsvp_status`

RSVP status split by category.

```sql
CREATE OR REPLACE VIEW v_current_year_rsvp_status AS
SELECT
  ey.year,
  c.category,
  p.rsvp_status,
  COUNT(*) AS contact_count
FROM event_year_participations p
JOIN contacts c        ON c.id = p.contact_id AND c.deleted_at IS NULL
JOIN event_years ey    ON ey.id = p.event_year_id AND ey.is_current = true
WHERE p.rsvp_status IS NOT NULL
GROUP BY ey.year, c.category, p.rsvp_status
ORDER BY c.category, p.rsvp_status;
```

---

## Migration / data import notes

When importing the existing spreadsheet data:

1. Insert rows into `event_years` for 2022–2026, mark 2026 as current.
2. Seed `agencies` from the 2026 dropdown list. For prior years' free-text agency entries, create agencies on demand with `active = false` if they don't appear in the 2026 list.
3. For each spreadsheet row, insert one `contacts` row.
4. For each year column group present in that row (e.g. `2023 Nominating Agency` + `2023 RSVP Status`), insert one `event_year_participations` row joined to the matching `event_year`.
5. Skip participation rows where all year-specific fields are empty for that year.
6. The 2022 columns in the source only include nominating agency and status (no RSVP) — leave `rsvp_status` NULL for those rows.

---

## Field-by-field mapping (source → schema)

| Source column | Schema location |
|---|---|
| Category | `contacts.category` |
| Company | `contacts.company` |
| Position | `contacts.position` |
| First Name | `contacts.first_name` |
| Last Name | `contacts.last_name` |
| City | `contacts.city` |
| Country | `contacts.country` |
| Gender | `contacts.gender` |
| Race | `contacts.race` |
| Email address | `contacts.email` |
| Assistants email | `contacts.assistant_email` |
| Mobile Number | `contacts.mobile_number` (text, not integer) |
| LinkedIn | `contacts.linkedin_url` |
| YYYY Nominating Agency | `event_year_participations.nominating_agency_id` (FK → `agencies`) |
| YYYY Status | `event_year_participations.invite_status` |
| YYYY RSVP Status | `event_year_participations.rsvp_status` |
| 2026 Nomination | `event_year_participations.nominated` |
| 2026 Priority | `event_year_participations.priority` |
| 2026 Nominator | `event_year_participations.nominator` |
| 2026 Comments/Actions | `event_year_participations.comments` |

---

## Open questions for the data owner

1. **Race categories** — confirm full SA EE set vs. source's "White, Colour" (currently using full set).
2. **Mobile number format** — single international format (`+27...`) or freeform? Spec uses text to allow either.
3. **Should `nominated` and `priority` exist for years before 2026**, or are those 2026-only fields? Spec assumes they apply to every year going forward.
4. **Soft-delete vs. hard-delete on contacts** — spec uses soft delete; confirm GDPR/POPIA approach if contacts request erasure.
5. **Country list** — store as free text (current spec), or migrate to FK against an ISO countries table?
