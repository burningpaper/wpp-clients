import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  organisations,
  contacts,
  contactAgencyRelationships,
  agencies,
  intelligenceNotes,
  orgTags,
  tags,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireAuth();
  const { id } = await params;

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, id))
    .limit(1);

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgContacts = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      lastUpdated: contacts.lastUpdated,
      agencyId: contactAgencyRelationships.agencyId,
      agencyName: agencies.name,
      relationshipStrength: contactAgencyRelationships.relationshipStrength,
    })
    .from(contacts)
    .leftJoin(
      contactAgencyRelationships,
      eq(contacts.id, contactAgencyRelationships.contactId)
    )
    .leftJoin(agencies, eq(contactAgencyRelationships.agencyId, agencies.id))
    .where(eq(contacts.orgId, id))
    .limit(100);

  const allNotes = await db
    .select()
    .from(intelligenceNotes)
    .where(eq(intelligenceNotes.orgId, id))
    .orderBy(intelligenceNotes.createdAt);

  const visibleNotes = allNotes.filter((n) => {
    if (n.visibility === "wpp_sa") return true;
    if (user.role === "ceo_md" || user.role === "system_admin") return true;
    return n.createdByAgencyId === user.agencyId;
  });

  const orgTagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(orgTags)
    .innerJoin(tags, eq(orgTags.tagId, tags.id))
    .where(eq(orgTags.orgId, id));

  return NextResponse.json({
    ...org,
    contacts: orgContacts,
    notes: visibleNotes,
    tags: orgTagRows,
  });
}

// ---------------------------------------------------------------------------
// PUT /api/organisations/[id]
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(255),
});

export async function PUT(req: Request, { params }: Params) {
  const user = await requireAuth();
  if (user.role !== "ceo_md" && user.role !== "system_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(organisations)
    .set({ name: parsed.data.name.trim() })
    .where(eq(organisations.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
