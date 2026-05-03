import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  contacts,
  organisations,
  intelligenceNotes,
  contactAgencyRelationships,
  agencies,
} from "@/db/schema";
import { ilike, or, sql, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2)
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  if (q.length > 100)
    return NextResponse.json({ error: "Query too long" }, { status: 400 });

  // Contacts + orgs: ILIKE search (fast on small dataset)
  const [contactRows, orgRows] = await Promise.all([
    db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        title: contacts.title,
        orgName: organisations.name,
        agencyName: agencies.name,
        relationshipStrength: contactAgencyRelationships.relationshipStrength,
      })
      .from(contacts)
      .innerJoin(organisations, eq(contacts.orgId, organisations.id))
      .leftJoin(
        contactAgencyRelationships,
        eq(contacts.id, contactAgencyRelationships.contactId)
      )
      .leftJoin(agencies, eq(contactAgencyRelationships.agencyId, agencies.id))
      .where(
        or(
          ilike(contacts.firstName, `%${q}%`),
          ilike(contacts.lastName, `%${q}%`),
          ilike(contacts.title, `%${q}%`),
          ilike(organisations.name, `%${q}%`)
        )
      )
      .limit(25),

    db
      .select()
      .from(organisations)
      .where(ilike(organisations.name, `%${q}%`))
      .limit(10),
  ]);

  // Full-text search on note bodies via GIN index
  const noteRows = await db
    .select()
    .from(intelligenceNotes)
    .where(
      sql`${intelligenceNotes.bodyTsv} @@ plainto_tsquery('english', ${q})`
    )
    .limit(15);

  const visibleNotes = noteRows.filter((n) => {
    if (n.visibility === "wpp_sa") return true;
    if (user.role === "ceo_md" || user.role === "system_admin") return true;
    return n.createdByAgencyId === user.agencyId;
  });

  return NextResponse.json({
    contacts: contactRows,
    organisations: orgRows,
    notes: visibleNotes,
  });
}
