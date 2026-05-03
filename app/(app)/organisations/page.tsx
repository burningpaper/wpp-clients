import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { organisations, contacts } from "@/db/schema";
import { eq, sql, ilike } from "drizzle-orm";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { OrgSearch } from "@/components/org-search";

export const dynamic = "force-dynamic";

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const rows = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      createdAt: organisations.createdAt,
      contactCount: sql<number>`(
        SELECT COUNT(*) FROM contacts WHERE contacts.org_id = organisations.id
      )`.as("contact_count"),
    })
    .from(organisations)
    .where(q.length >= 2 ? ilike(organisations.name, `%${q}%`) : undefined)
    .orderBy(organisations.name)
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Organisations</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {rows.length} organisation{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <OrgSearch defaultValue={q} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {rows.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-gray-500">
            No organisations found.
          </div>
        ) : (
          rows.map((org) => (
            <Link
              key={org.id}
              href={`/organisations/${org.id}`}
              className="flex items-center gap-4 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl px-4 py-4 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors truncate">
                  {org.name}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {Number(org.contactCount)}{" "}
                  {Number(org.contactCount) === 1 ? "contact" : "contacts"}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
