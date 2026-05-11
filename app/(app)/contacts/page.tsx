import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  contacts,
  organisations,
  contactAgencyRelationships,
  agencies,
} from "@/db/schema";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { StrengthBadge } from "@/components/strength-badge";
import { ContactsFilter } from "@/components/contacts-filter";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

type SearchParams = {
  q?: string;
  strength?: string;
  agency?: string;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const strengthFilter = sp.strength as "cold" | "warm" | "strong" | undefined;
  const agencyFilter = sp.agency;

  const conditions = [];

  if (q && q.length >= 2) {
    conditions.push(
      or(
        ilike(contacts.firstName, `%${q}%`),
        ilike(contacts.lastName, `%${q}%`),
        ilike(contacts.title, `%${q}%`),
        ilike(contacts.company, `%${q}%`),
        ilike(organisations.name, `%${q}%`)
      )
    );
  }
  if (agencyFilter) {
    conditions.push(eq(contactAgencyRelationships.agencyId, agencyFilter));
  }
  if (strengthFilter) {
    conditions.push(
      eq(contactAgencyRelationships.relationshipStrength, strengthFilter)
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }], allAgencies] = await Promise.all([
    db
      .selectDistinctOn([contacts.id], {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        title: contacts.title,
        company: contacts.company,
        lastUpdated: contacts.lastUpdated,
        orgId: contacts.orgId,
        orgName: organisations.name,
        agencyId: contactAgencyRelationships.agencyId,
        agencyName: agencies.name,
        relationshipStrength: contactAgencyRelationships.relationshipStrength,
      })
      .from(contacts)
      .leftJoin(organisations, eq(contacts.orgId, organisations.id))
      .leftJoin(
        contactAgencyRelationships,
        eq(contacts.id, contactAgencyRelationships.contactId)
      )
      .leftJoin(agencies, eq(contactAgencyRelationships.agencyId, agencies.id))
      .where(where)
      .orderBy(contacts.id)
      .limit(PAGE_SIZE),

    db
      .select({ total: sql<number>`COUNT(DISTINCT ${contacts.id})::int` })
      .from(contacts)
      .leftJoin(organisations, eq(contacts.orgId, organisations.id))
      .leftJoin(
        contactAgencyRelationships,
        eq(contacts.id, contactAgencyRelationships.contactId)
      )
      .leftJoin(agencies, eq(contactAgencyRelationships.agencyId, agencies.id))
      .where(where),

    db.select().from(agencies).orderBy(agencies.name),
  ]);

  rows.sort((a, b) =>
    a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)
  );

  const isCapped = rows.length < total;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Contacts</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {isCapped
              ? `Showing ${rows.length} of ${total} contacts`
              : `${total} contact${total !== 1 ? "s" : ""}`}
            {q ? ` matching "${q}"` : ""}
          </p>
        </div>
        <Link
          href="/contacts/new"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add contact
        </Link>
      </div>

      {/* Search + filters */}
      <ContactsFilter agencies={allAgencies} />

      {/* Cap notice */}
      {isCapped && !q && (
        <p className="mt-3 text-xs text-gray-500">
          Showing the first {PAGE_SIZE} contacts — use the search box to find anyone specific.
        </p>
      )}

      {/* Contact list */}
      <div className="mt-4 space-y-1">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {q
              ? `No contacts match "${q}"`
              : "No contacts yet. Add the first one."}
          </div>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`/contacts/${row.id}`}
              className="flex items-center gap-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg px-4 py-3.5 transition-all group"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                <span className="text-gray-300 text-sm font-medium">
                  {row.firstName[0]}
                  {row.lastName[0]}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors">
                  {row.firstName} {row.lastName}
                </p>
                <p className="text-gray-400 text-xs mt-0.5 truncate">
                  {row.title ? `${row.title} · ` : ""}
                  {row.orgName ?? row.company ?? ""}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {row.agencyName && (
                  <span className="text-gray-500 text-xs">{row.agencyName}</span>
                )}
                <StrengthBadge strength={row.relationshipStrength} />
                <span className="text-gray-600 text-xs">
                  {timeAgo(row.lastUpdated)}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
