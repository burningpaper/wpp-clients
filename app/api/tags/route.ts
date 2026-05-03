import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { tags, contactTags, orgTags } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const rows = q
    ? await db.select().from(tags).where(ilike(tags.name, `%${q}%`)).limit(20)
    : await db.select().from(tags).limit(100);

  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().min(1).max(50),
  contactId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  await requireAuth();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { name, contactId, orgId } = parsed.data;

  // Upsert tag
  const [tag] = await db
    .insert(tags)
    .values({ name })
    .onConflictDoUpdate({ target: tags.name, set: { name } })
    .returning();

  // Attach to contact or org if provided
  if (contactId) {
    await db
      .insert(contactTags)
      .values({ contactId, tagId: tag.id })
      .onConflictDoNothing();
  }
  if (orgId) {
    await db
      .insert(orgTags)
      .values({ orgId, tagId: tag.id })
      .onConflictDoNothing();
  }

  return NextResponse.json(tag, { status: 201 });
}
