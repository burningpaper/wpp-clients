import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const url = (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
if (!url) throw new Error("DATABASE_URL is required");

const client = postgres(url, { max: 1 });

async function migrate() {
  // Create the migrations ledger table if it doesn't exist
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Bootstrap: if the agencies table already exists but the ledger is empty,
  // the initial migration was applied before this ledger existed — mark it done
  const [{ exists: agenciesExists }] = await client<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'agencies'
    ) AS exists
  `;
  if (agenciesExists) {
    await client`
      INSERT INTO _migrations (filename) VALUES ('0001_initial.sql')
      ON CONFLICT DO NOTHING
    `;
  }

  // Collect already-applied filenames
  const applied = await client<{ filename: string }[]>`
    SELECT filename FROM _migrations ORDER BY filename
  `;
  const appliedSet = new Set(applied.map((r) => r.filename));

  // Scan migrations directory in alphabetical order
  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`Applying ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await client.unsafe(sql);
    await client`INSERT INTO _migrations (filename) VALUES (${file})`;
    console.log(`Applied ${file}`);
  }

  console.log("All migrations complete.");
  await client.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
