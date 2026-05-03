import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  contacts,
  organisations,
  contactAgencyRelationships,
  agencies,
  contactTags,
  tags,
} from "@/db/schema";
import { eq, ilike, or, sql, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/contacts?q=…&agency=…&strength=…&tag=…
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const agencyFilter = searchParams.get("agency");
  const strengthFilter = searchParams.get("strength") as
    | "cold"
    | "warm"
    | "strong"
    | null;
  const tagFilter = searchParams.get("tag");

  // Rate limit: enforce minimum query length and result cap
  if (q && q.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }
  if (q.length > 100) {
    return NextResponse.json(
      { error: "Query too long" },
      { status: 400 }
    );
  }

  const conditions = [];

  if (q) {
    conditions.push(
      or(
        ilike(contacts.firstName, `%${q}%`),
        ilike(contacts.lastName, `%${q}%`),
        ilike(contacts.title, `%${q}%`),
        ilike(organisations.name, `%${q}%`)
      )
    );
  }

  if (agencyFilter) {
    conditions.push(
      eq(contactAgencyRelationships.agencyId, agencyFilter)
    );
  }

  if (strengthFilter) {
    conditions.push(
      eq(contactAgencyRelationships.relationshipStrength, strengthFilter)
    );
  }

  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      email: contacts.email,
      lastUpdated: contacts.lastUpdated,
      orgName: organisations.name,
      orgId: contacts.orgId,
      agencyId: contactAgencyRelationships.agencyId,
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
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(50);

  // Tag filter applied in memory (small result set already capped at 50)
  if (tagFilter) {
    const contactIds = new Set(rows.map((r) => r.id));
    const taggedIds = await db
      .select({ contactId: contactTags.contactId })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(
        and(
          eq(tags.name, tagFilter),
          sql`${contactTags.contactId} = ANY(${sql.raw(
            `ARRAY[${[...contactIds].map((id) => `'${id}'`).join(",")}]::uuid[]`
          )})`
        )
      );
    const taggedSet = new Set(taggedIds.map((r) => r.contactId));
    return NextResponse.json(rows.filter((r) => taggedSet.has(r.id)));
  }

  return NextResponse.json(rows);
}

// ---------------------------------------------------------------------------
// POST /api/contacts
// ---------------------------------------------------------------------------

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  orgId: z.string().uuid(),
  title: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  agencyId: z.string().uuid(),
  relationshipStrength: z.enum(["cold", "warm", "strong"]),
  lastContactDate: z.string().datetime().optional().nullable(),
});

export async function POST(req: Request) {
  const user = await requireAuth();

  // Permission: account directors can only create for their agency
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );

  const d = parsed.data;

  if (
    user.role === "account_director" &&
    d.agencyId !== user.agencyId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Atomically create contact + junction row
  const [contact] = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(contacts)
      .values({
        firstName: d.firstName,
        lastName: d.lastName,
        orgId: d.orgId,
        title: d.title || null,
        email: d.email || null,
      })
      .returning();

    await tx.insert(contactAgencyRelationships).values({
      contactId: c.id,
      agencyId: d.agencyId,
      relationshipStrength: d.relationshipStrength,
      lastContactDate: d.lastContactDate
        ? new Date(d.lastContactDate)
        : null,
      relationshipOwnerId: user.id,
    });

    return [c];
  });

  return NextResponse.json(contact, { status: 201 });
}
