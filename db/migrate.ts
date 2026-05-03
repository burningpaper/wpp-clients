import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const client = postgres(url, { max: 1 });

const sql = readFileSync(join(__dirname, "migrations/0001_initial.sql"), "utf8");

async function migrate() {
  console.log("Running migration...");
  await client.unsafe(sql);
  console.log("Migration complete.");
  await client.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
