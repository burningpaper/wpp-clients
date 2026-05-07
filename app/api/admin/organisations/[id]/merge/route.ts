import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  organisations,
  contacts,
  intelligenceNotes,
  orgTags,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  targetId: z.string().uuid(),
});

// POST /api/admin/organisations/[id]/merge
// Merges org [id] (source) INTO targetId (kept).
// Moves all contacts, notes, and tags from source → target, then deletes source.
export async function POST(req: Request, { params }: Params) {
  const user = await requireAuth();
  if (user.role !== "system_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sourceId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { targetId } = parsed.data;

  if (sourceId === targetId) {
    return NextResponse.json(
      { error: "Source and target must differ" },
      { status: 400 }
    );
  }

  // Verify both orgs exist
  const [source, target] = await Promise.all([
    db.select().from(organisations).where(eq(organisations.id, sourceId)).limit(1),
    db.select().from(organisations).where(eq(organisations.id, targetId)).limit(1),
  ]);
  if (!source[0]) return NextResponse.json({ error: "Source org not found" }, { status: 404 });
  if (!target[0]) return NextResponse.json({ error: "Target org not found" }, { status: 404 });

  // All operations in a single transaction
  await db.transaction(async (tx) => {
    // Move contacts
    await tx
      .update(contacts)
      .set({ orgId: targetId })
      .where(eq(contacts.orgId, sourceId));

    // Move intelligence notes
    await tx
      .update(intelligenceNotes)
      .set({ orgId: targetId })
      .where(eq(intelligenceNotes.orgId, sourceId));

    // Move org tags (ignore conflicts — target may already have the tag)
    await tx.execute(sql`
      INSERT INTO org_tags (org_id, tag_id)
      SELECT ${targetId}, tag_id FROM org_tags WHERE org_id = ${sourceId}
      ON CONFLICT DO NOTHING
    `);
    await tx.execute(sql`
      DELETE FROM org_tags WHERE org_id = ${sourceId}
    `);

    // Delete source org
    await tx.delete(organisations).where(eq(organisations.id, sourceId));
  });

  return NextResponse.json({ ok: true, merged: source[0].name, into: target[0].name });
}
