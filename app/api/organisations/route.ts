import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { ilike } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const rows = q
    ? await db
        .select()
        .from(organisations)
        .where(ilike(organisations.name, `%${q}%`))
        .limit(50)
    : await db.select().from(organisations).limit(200);

  return NextResponse.json(rows);
}

const createSchema = z.object({ name: z.string().min(1) });

export async function POST(req: Request) {
  await requireAuth();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const [org] = await db
    .insert(organisations)
    .values({ name: parsed.data.name })
    .returning();

  return NextResponse.json(org, { status: 201 });
}
