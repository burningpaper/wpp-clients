import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { intelligenceNotes } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  orgId: z.string().uuid().optional().nullable(),
  noteType: z.enum(["meeting", "news", "budget_signal", "relationship", "risk"]),
  body: z.string().min(1).max(10000),
  visibility: z.enum(["wpp_sa", "agency_only"]).default("wpp_sa"),
});

export async function POST(req: Request) {
  const user = await requireAuth();

  if (!user.agencyId) {
    return NextResponse.json(
      { error: "Agency must be set before adding notes" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const d = parsed.data;
  if (!d.contactId && !d.orgId)
    return NextResponse.json(
      { error: "contactId or orgId required" },
      { status: 400 }
    );
  if (d.contactId && d.orgId)
    return NextResponse.json(
      { error: "Provide contactId or orgId, not both" },
      { status: 400 }
    );

  const [note] = await db
    .insert(intelligenceNotes)
    .values({
      contactId: d.contactId ?? null,
      orgId: d.orgId ?? null,
      noteType: d.noteType,
      body: d.body,
      visibility: d.visibility,
      createdByAgencyId: user.agencyId,
      createdByUserId: user.id,
    })
    .returning();

  return NextResponse.json(note, { status: 201 });
}

export async function GET(req: Request) {
  const user = await requireAuth();
  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const orgId = searchParams.get("orgId");

  if (!contactId && !orgId)
    return NextResponse.json({ error: "contactId or orgId required" }, { status: 400 });

  const where = contactId
    ? eq(intelligenceNotes.contactId, contactId)
    : eq(intelligenceNotes.orgId, orgId!);

  const notes = await db
    .select()
    .from(intelligenceNotes)
    .where(where)
    .orderBy(intelligenceNotes.createdAt);

  const visible = notes.filter((n) => {
    if (n.visibility === "wpp_sa") return true;
    if (user.role === "ceo_md" || user.role === "system_admin") return true;
    return n.createdByAgencyId === user.agencyId;
  });

  return NextResponse.json(visible);
}
