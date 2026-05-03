import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!;

// For server-side use — pooled connection (Neon HTTP driver works too but
// postgres.js gives us transaction support needed for the CSV import)
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
export * from "./schema";
