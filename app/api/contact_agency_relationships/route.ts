import { NextResponse } from "next/server";
import { requireAuth, canWrite } from "@/lib/auth";
import { db } from "@/db";
import { contactAgencyRelationships } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  contactId: z.string().uuid(),
  agencyId: z.string().uuid(),
  relationshipStrength: z.enum(["cold", "warm", "strong"]),
  associationType: z.enum(["client_of", "ex_client_of", "other"]).optional().nullable(),
  lastContactDate: z.string().datetime().optional().nullable(),
  relationshipOwnerId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  const user = await requireAuth();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const d = parsed.data;
  if (!canWrite(user, d.agencyId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db
    .insert(contactAgencyRelationships)
    .values({
      contactId: d.contactId,
      agencyId: d.agencyId,
      relationshipStrength: d.relationshipStrength,
      associationType: d.associationType ?? null,
      lastContactDate: d.lastContactDate ? new Date(d.lastContactDate) : null,
      relationshipOwnerId: d.relationshipOwnerId ?? null,
    })
    .onConflictDoUpdate({
      target: [
        contactAgencyRelationships.contactId,
        contactAgencyRelationships.agencyId,
      ],
      set: {
        relationshipStrength: d.relationshipStrength,
        associationType: d.associationType ?? null,
        lastContactDate: d.lastContactDate
          ? new Date(d.lastContactDate)
          : null,
        relationshipOwnerId: d.relationshipOwnerId ?? null,
      },
    });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PUT(req: Request) {
  const user = await requireAuth();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const d = parsed.data;
  if (!canWrite(user, d.agencyId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db
    .update(contactAgencyRelationships)
    .set({
      relationshipStrength: d.relationshipStrength,
      associationType: d.associationType ?? null,
      lastContactDate: d.lastContactDate ? new Date(d.lastContactDate) : null,
      relationshipOwnerId: d.relationshipOwnerId ?? null,
    })
    .where(
      and(
        eq(contactAgencyRelationships.contactId, d.contactId),
        eq(contactAgencyRelationships.agencyId, d.agencyId)
      )
    );

  return NextResponse.json({ ok: true });
}
