import { NextResponse } from "next/server";
import { requireAuth, canWrite } from "@/lib/auth";
import { db } from "@/db";
import {
  contacts,
  organisations,
  contactAgencyRelationships,
  agencies,
  intelligenceNotes,
  contactTags,
  tags,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/contacts/[id]
// ---------------------------------------------------------------------------

export async function GET(_req: Request, { params }: Params) {
  const user = await requireAuth();
  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [org] = contact.orgId
    ? await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, contact.orgId))
        .limit(1)
    : [undefined];

  const relationships = await db
    .select({
      agencyId: contactAgencyRelationships.agencyId,
      agencyName: agencies.name,
      relationshipStrength: contactAgencyRelationships.relationshipStrength,
      lastContactDate: contactAgencyRelationships.lastContactDate,
      relationshipOwnerId: contactAgencyRelationships.relationshipOwnerId,
    })
    .from(contactAgencyRelationships)
    .innerJoin(agencies, eq(contactAgencyRelationships.agencyId, agencies.id))
    .where(eq(contactAgencyRelationships.contactId, id));

  // Notes: filter by visibility
  const allNotes = await db
    .select()
    .from(intelligenceNotes)
    .where(eq(intelligenceNotes.contactId, id))
    .orderBy(intelligenceNotes.createdAt);

  const visibleNotes = allNotes.filter((note) => {
    if (note.visibility === "wpp_sa") return true;
    if (user.role === "ceo_md" || user.role === "system_admin") return true;
    return note.createdByAgencyId === user.agencyId;
  });

  const contactTagRows = await db
    .select({ name: tags.name, id: tags.id })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(contactTags.contactId, id));

  return NextResponse.json({
    ...contact,
    org,
    relationships,
    notes: visibleNotes,
    tags: contactTagRows,
  });
}

// ---------------------------------------------------------------------------
// PUT /api/contacts/[id]
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  title: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  agencyId: z.string().uuid(),
});

export async function PUT(req: Request, { params }: Params) {
  const user = await requireAuth();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { agencyId, ...fields } = parsed.data;

  if (!canWrite(user, agencyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [updated] = await db
    .update(contacts)
    .set({ ...fields, email: fields.email || null })
    .where(eq(contacts.id, id))
    .returning();

  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// DELETE /api/contacts/[id]
// ---------------------------------------------------------------------------

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireAuth();
  const { id } = await params;

  if (user.role !== "system_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(contacts).where(eq(contacts.id, id));
  return NextResponse.json({ ok: true });
}
