import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  contacts,
  organisations,
  contactAgencyRelationships,
  agencies,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Papa from "papaparse";
import { z } from "zod";

export const dynamic = "force-dynamic";

const rowSchema = z.object({
  first_name: z.string().min(1, "first_name required"),
  last_name: z.string().min(1, "last_name required"),
  organisation: z.string().min(1, "organisation required"),
  title: z.string().optional(),
  email: z.string().email("invalid email").optional().or(z.literal("")),
  agency: z.string().min(1, "agency required"),
  relationship_strength: z
    .enum(["cold", "warm", "strong"])
    .transform((v) => v)
    .pipe(z.enum(["cold", "warm", "strong"])),
});

type ParsedRow = z.infer<typeof rowSchema>;
type RowError = { row: number; field: string; message: string };

export async function POST(req: Request) {
  const user = await requireAuth();

  // Only champions, CEO/MD, or system admin can import
  if (
    user.role === "account_director" &&
    !user.isChampion
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  // Guard against oversized uploads
  if (file.size > 4 * 1024 * 1024)
    return NextResponse.json(
      { error: "File too large (max 4MB)" },
      { status: 400 }
    );

  const text = await file.text();
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(
    text,
    {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      transform: (v) => v.trim(),
    }
  );

  if (parseErrors.length > 0) {
    return NextResponse.json(
      { errors: parseErrors.map((e) => ({ row: e.row, message: e.message })) },
      { status: 422 }
    );
  }

  // --- PASS 1: Validate all rows ---
  const rowErrors: RowError[] = [];
  const validRows: ParsedRow[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const result = rowSchema.safeParse(row);
    if (!result.success) {
      for (const issue of result.error.issues) {
        rowErrors.push({
          row: i + 2, // 1-indexed, accounting for header
          field: String(issue.path[0] ?? "unknown"),
          message: issue.message,
        });
      }
    } else {
      validRows.push(result.data);
    }
  }

  if (rowErrors.length > 0) {
    return NextResponse.json({ errors: rowErrors }, { status: 422 });
  }

  // Pre-load all agencies for fast lookup
  const allAgencies = await db.select().from(agencies);
  const agencyMap = new Map(allAgencies.map((a) => [a.name.toLowerCase(), a]));

  // Validate agency names exist before writing anything
  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    if (!agencyMap.has(row.agency.toLowerCase())) {
      rowErrors.push({
        row: i + 2,
        field: "agency",
        message: `Unknown agency: "${row.agency}"`,
      });
    }
  }

  if (rowErrors.length > 0) {
    return NextResponse.json({ errors: rowErrors }, { status: 422 });
  }

  // --- PASS 2: Write all rows in a single transaction ---
  const imported = await db.transaction(async (tx) => {
    let count = 0;

    for (const row of validRows) {
      const agency = agencyMap.get(row.agency.toLowerCase())!;

      // Upsert organisation
      const [org] = await tx
        .insert(organisations)
        .values({ name: row.organisation })
        .onConflictDoUpdate({
          target: organisations.name,
          set: { name: row.organisation },
        })
        .returning();

      // Insert contact
      const [contact] = await tx
        .insert(contacts)
        .values({
          firstName: row.first_name,
          lastName: row.last_name,
          orgId: org.id,
          title: row.title || null,
          email: row.email || null,
        })
        .returning();

      // Insert relationship
      await tx
        .insert(contactAgencyRelationships)
        .values({
          contactId: contact.id,
          agencyId: agency.id,
          relationshipStrength: row.relationship_strength,
        })
        .onConflictDoUpdate({
          target: [
            contactAgencyRelationships.contactId,
            contactAgencyRelationships.agencyId,
          ],
          set: { relationshipStrength: row.relationship_strength },
        });

      count++;
    }

    return count;
  });

  return NextResponse.json({ imported }, { status: 201 });
}
