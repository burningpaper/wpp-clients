import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { users, agencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ agencyId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await requireAuth();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // agencyId could be a name (from the select) or a UUID
  const { agencyId } = parsed.data;

  // Look up by name first (the client sends the name from the hard-coded list)
  const agency = await db
    .select()
    .from(agencies)
    .where(eq(agencies.name, agencyId))
    .limit(1);

  const resolvedId = agency[0]?.id ?? agencyId;

  await db
    .update(users)
    .set({ agencyId: resolvedId })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
