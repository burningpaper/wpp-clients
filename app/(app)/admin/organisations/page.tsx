import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { organisations, contacts } from "@/db/schema";
import { notFound } from "next/navigation";
import { sql, isNull, count } from "drizzle-orm";
import { Building2, Database } from "lucide-react";
import { AdminNormalise } from "@/components/admin-normalise";
import { AdminOrgMerge } from "@/components/admin-org-merge";

export const dynamic = "force-dynamic";

export default async function AdminOrganisationsPage() {
  const user = await requireAuth();
  if (user.role !== "system_admin") notFound();

  const [orgsRaw, [{ unmapped }], [{ distinctCompanies }]] = await Promise.all([
    // All orgs with contact counts
    db.execute(sql`
      SELECT o.id, o.name, count(c.id)::int AS "contactCount"
      FROM organisations o
      LEFT JOIN contacts c ON c.org_id = o.id
      GROUP BY o.id, o.name
      ORDER BY lower(o.name)
    `),

    // Contacts with no org
    db.execute(sql`
      SELECT count(*)::int AS unmapped
      FROM contacts WHERE org_id IS NULL
    `),

    // Distinct unmapped company strings
    db.execute(sql`
      SELECT count(DISTINCT lower(trim(company)))::int AS "distinctCompanies"
      FROM contacts
      WHERE org_id IS NULL AND company IS NOT NULL AND company != ''
    `),
  ]);

  // postgres.js RowList is directly iterable as the rows
  const orgs = (orgsRaw as unknown as { id: string; name: string; contactCount: number }[]);
  const unmappedCount = (unmapped as unknown as number) ?? 0;
  const distinctCount = (distinctCompanies as unknown as number) ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-600/30 flex items-center justify-center">
          <Database className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-semibold">
            Organisations
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {orgs.length.toLocaleString()} organisation{orgs.length !== 1 ? "s" : ""} ·{" "}
            {unmappedCount.toLocaleString()} unlinked contact{unmappedCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Step 1: Normalise */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <h2 className="text-white font-medium">
            Create organisations from company names
          </h2>
        </div>
        <AdminNormalise
          unmappedCount={unmappedCount}
          distinctCompanyCount={distinctCount}
        />
      </div>

      {/* Step 2: Merge duplicates */}
      {orgs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <h2 className="text-white font-medium">Merge duplicates</h2>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Search for similar names, hover a row, click{" "}
            <span className="text-gray-300 font-medium">Merge</span>, then pick
            which organisation to keep. The duplicate is deleted and its contacts
            move to the canonical record.
          </p>
          <AdminOrgMerge orgs={orgs} />
        </div>
      )}
    </div>
  );
}
