/**
 * One-time seed import for historical WPP Stream data.
 *
 * Source files (db/seed-data/):
 *   agencies.csv               — agency names + active flag
 *   contacts.csv               — ~1600 stream contacts
 *   event_year_participations.csv — per-year participation records
 *   participation_agencies.csv — junction: participation ↔ agency
 *   flagged_rows.csv           — data-quality issues (logged, not imported)
 *
 * Run:
 *   npx tsx db/import.ts            # dry run — shows what would be imported
 *   npx tsx db/import.ts --apply    # writes to DB
 */

import { loadEnvConfig } from "@next/env";
import Papa from "papaparse";
import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const DRY_RUN = !process.argv.includes("--apply");
const SEED_DIR = join(__dirname, "seed-data");

const db = postgres(url, { max: 1 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCsv<T extends Record<string, string>>(filename: string): T[] {
  const raw = readFileSync(join(SEED_DIR, filename), "utf8");
  const result = Papa.parse<T>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length) {
    console.warn(`  Parse warnings in ${filename}:`, result.errors.slice(0, 3));
  }
  return result.data;
}

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function extractEmail(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (EMAIL_RE.test(trimmed)) return trimmed;
  // Pull the first plausible email out of messy fields like:
  //   "akhona@yum.com\nPA Email address: mastoora@yum.com"
  //   "anele@947.co.za / owen@osmtalent.com"
  const match = trimmed.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  return match ? match[0] : null;
}

function nullIfEmpty(v: string | undefined): string | null {
  return v && v.trim() ? v.trim() : null;
}

// ---------------------------------------------------------------------------
// Valid enum values (must match 0002_stream.sql)
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = new Set([
  "client_sa", "client_africa", "client_global",
  "industry_sa", "industry_africa", "industry_global",
  "agency_sa", "agency_africa", "agency_global",
  "rising_star",
]);

const VALID_GENDERS = new Set(["male", "female", "unknown"]);
const VALID_RACES = new Set(["african", "coloured", "indian", "white", "other"]);

const VALID_INVITE_STATUS = new Set([
  "first_round_invite", "second_round_invite", "third_round_invite",
  "agency_invite", "rising_star_invite", "waiting_list", "other_invite", "no",
]);

const VALID_RSVP_STATUS = new Set([
  "pending", "bounced", "error", "accepted", "declined",
  "cancelled", "no_show", "accepted_on_their_behalf",
]);

const VALID_PRIORITY = new Set(["yes", "other"]);

// ---------------------------------------------------------------------------
// Import steps
// ---------------------------------------------------------------------------

async function importAgencies(): Promise<void> {
  type AgencyRow = { name: string; active: string };
  const rows = readCsv<AgencyRow>("agencies.csv");

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.name?.trim()) { skipped++; continue; }

    if (!DRY_RUN) {
      await db`
        INSERT INTO agencies (name, active)
        VALUES (${row.name.trim()}, ${row.active === "True"})
        ON CONFLICT (name) DO NOTHING
      `;
    }
    inserted++;
  }

  console.log(`  agencies: ${inserted} upserted, ${skipped} skipped`);
}

async function importContacts(): Promise<Map<string, string>> {
  type ContactRow = {
    id: string; category: string; company: string; position: string;
    first_name: string; last_name: string; city: string; country: string;
    gender: string; race: string; email: string; assistant_email: string;
    mobile_number: string; linkedin_url: string;
  };

  const rows = readCsv<ContactRow>("contacts.csv");
  const csvToDbId = new Map<string, string>(); // contact_00001 → DB uuid

  let inserted = 0;
  let skippedCategory = 0;
  let skippedNoName = 0;

  for (const row of rows) {
    if (!row.first_name?.trim() || !row.last_name?.trim()) {
      console.log(`  SKIP ${row.id} — missing name`);
      skippedNoName++;
      continue;
    }

    const category = VALID_CATEGORIES.has(row.category?.trim())
      ? row.category.trim()
      : null;

    if (!category) {
      skippedCategory++; // counted but still imported
    }

    const email = extractEmail(row.email);
    const assistantEmail = extractEmail(row.assistant_email);
    const gender = VALID_GENDERS.has(row.gender?.trim()) ? row.gender.trim() : null;
    const race = VALID_RACES.has(row.race?.trim()) ? row.race.trim() : null;

    if (DRY_RUN) {
      csvToDbId.set(row.id, `dry-${row.id}`);
      inserted++;
      continue;
    }

    const [result] = await db<{ id: string }[]>`
      INSERT INTO stream_contacts
        (category, company, position, first_name, last_name,
         city, country, gender, race, email, assistant_email,
         mobile_number, linkedin_url)
      VALUES
        (${category}, ${nullIfEmpty(row.company)}, ${nullIfEmpty(row.position)},
         ${row.first_name.trim()}, ${row.last_name.trim()},
         ${nullIfEmpty(row.city)}, ${nullIfEmpty(row.country)},
         ${gender}, ${race},
         ${email}, ${assistantEmail},
         ${nullIfEmpty(row.mobile_number)}, ${nullIfEmpty(row.linkedin_url)})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    if (result) {
      csvToDbId.set(row.id, result.id);
      inserted++;
    } else {
      // Duplicate email — still map if contact already exists
      const [existing] = await db<{ id: string }[]>`
        SELECT id FROM stream_contacts
        WHERE email = ${email} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (existing) csvToDbId.set(row.id, existing.id);
    }
  }

  console.log(
    `  contacts: ${inserted} inserted (${skippedCategory} with null category), ${skippedNoName} skipped (no name)`
  );
  return csvToDbId;
}

async function importParticipations(
  csvToDbId: Map<string, string>
): Promise<Map<string, string>> {
  type PartRow = {
    id: string; contact_id: string; year: string;
    nominated: string; priority: string; nominator: string;
    invite_status: string; rsvp_status: string; comments: string;
  };

  const rows = readCsv<PartRow>("event_year_participations.csv");
  const partIdToDbId = new Map<string, string>(); // part_000001 → DB uuid

  // Fetch event year id → uuid map
  const eventYearRows = await db<{ id: string; year: number }[]>`
    SELECT id, year FROM event_years
  `;
  const yearToId = new Map(eventYearRows.map((r) => [String(r.year), r.id]));

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const contactDbId = csvToDbId.get(row.contact_id);
    const eventYearId = yearToId.get(row.year?.trim());

    if (!contactDbId || !eventYearId) {
      skipped++;
      continue;
    }

    const inviteStatus = VALID_INVITE_STATUS.has(row.invite_status?.trim())
      ? row.invite_status.trim()
      : null;
    const rsvpStatus = VALID_RSVP_STATUS.has(row.rsvp_status?.trim())
      ? row.rsvp_status.trim()
      : null;
    const priority = VALID_PRIORITY.has(row.priority?.trim())
      ? row.priority.trim()
      : null;

    if (DRY_RUN) {
      partIdToDbId.set(row.id, `dry-${row.id}`);
      inserted++;
      continue;
    }

    const [result] = await db<{ id: string }[]>`
      INSERT INTO event_year_participations
        (contact_id, event_year_id, nominated, priority, nominator,
         invite_status, rsvp_status, comments)
      VALUES
        (${contactDbId}, ${eventYearId},
         ${row.nominated === "True"},
         ${priority}, ${nullIfEmpty(row.nominator)},
         ${inviteStatus}, ${rsvpStatus},
         ${nullIfEmpty(row.comments)})
      ON CONFLICT (contact_id, event_year_id) DO NOTHING
      RETURNING id
    `;

    if (result) {
      partIdToDbId.set(row.id, result.id);
      inserted++;
    }
  }

  console.log(`  participations: ${inserted} inserted, ${skipped} skipped (no contact or year)`);
  return partIdToDbId;
}

async function importParticipationAgencies(
  partIdToDbId: Map<string, string>
): Promise<void> {
  type PARow = { participation_id: string; agency_name: string; is_primary: string };

  const rows = readCsv<PARow>("participation_agencies.csv");

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const participationDbId = partIdToDbId.get(row.participation_id);
    if (!participationDbId) { skipped++; continue; }

    if (!DRY_RUN) {
      await db`
        INSERT INTO participation_agencies (participation_id, agency_name, is_primary)
        VALUES (${participationDbId}, ${row.agency_name.trim()}, ${row.is_primary === "True"})
      `;
    }
    inserted++;
  }

  console.log(`  participation_agencies: ${inserted} inserted, ${skipped} skipped (no matching participation)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (pass --apply to write) ===" : "=== IMPORTING ===");

  console.log("\n[1/4] Agencies");
  await importAgencies();

  console.log("\n[2/4] Contacts");
  const csvToDbId = await importContacts();

  console.log("\n[3/4] Participations");
  const partIdToDbId = await importParticipations(csvToDbId);

  console.log("\n[4/4] Participation agencies");
  await importParticipationAgencies(partIdToDbId);

  console.log("\nDone.");
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
