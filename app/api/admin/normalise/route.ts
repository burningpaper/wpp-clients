import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireAuth();
  if (user.role !== "system_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Distinct company strings from contacts that don't yet have an org_id
  const distinctRaw = await db.execute(sql`
    SELECT DISTINCT ON (lower(trim(company))) trim(company) AS name
    FROM contacts
    WHERE company IS NOT NULL
      AND company != ''
      AND org_id IS NULL
    ORDER BY lower(trim(company)), company
  `);

  const distinctCompanies = distinctRaw as unknown as { name: string }[];

  if (distinctCompanies.length === 0) {
    return NextResponse.json({ created: 0, linked: 0 });
  }

  // Load existing org names so we don't create duplicates
  const existing = await db
    .select({ id: organisations.id, name: organisations.name })
    .from(organisations);

  const orgByLower = new Map<string, string>(
    existing.map((o) => [o.name.toLowerCase(), o.id])
  );

  // Create orgs only for names that don't already exist (case-insensitive)
  const toCreate = distinctCompanies.filter(
    (r) => !orgByLower.has(r.name.toLowerCase())
  );

  let created = 0;
  if (toCreate.length > 0) {
    const BATCH = 200;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      const batch = toCreate.slice(i, i + BATCH);
      const inserted = await db
        .insert(organisations)
        .values(batch.map((r) => ({ name: r.name })))
        .returning({ id: organisations.id, name: organisations.name });
      for (const org of inserted) {
        orgByLower.set(org.name.toLowerCase(), org.id);
      }
      created += inserted.length;
    }
  }

  // Link contacts to their org by case-insensitive name match
  const linkResult = await db.execute(sql`
    UPDATE contacts c
    SET org_id = o.id
    FROM organisations o
    WHERE lower(o.name) = lower(trim(c.company))
      AND c.org_id IS NULL
      AND c.company IS NOT NULL
      AND c.company != ''
  `);

  const linked = (linkResult as unknown as { count: number }).count ?? 0;

  return NextResponse.json({ created, linked });
}
