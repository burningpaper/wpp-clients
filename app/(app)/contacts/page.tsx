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
  page?: string;
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
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

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
      .selectDistinctOn([contacts.firstName, contacts.lastName, contacts.id], {
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
      .orderBy(contacts.firstName, contacts.lastName, contacts.id)
      .limit(PAGE_SIZE)
      .offset(offset),

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build a URL for a given page, preserving existing filters
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sp.strength) params.set("strength", sp.strength);
    if (sp.agency) params.set("agency", sp.agency);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/contacts${qs ? `?${qs}` : ""}`;
  }

  const start = offset + 1;
  const end = Math.min(offset + rows.length, total);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Contacts</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {total === 0
              ? "No contacts"
              : totalPages > 1
              ? `${start}–${end} of ${total} contact${total !== 1 ? "s" : ""}`
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

      {/* Contact list */}
      <div className="mt-4 space-y-1">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {q ? `No contacts match "${q}"` : "No contacts yet. Add the first one."}
          </div>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`/contacts/${row.id}`}
              className="flex items-center gap-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg px-4 py-3.5 transition-all group"
            >
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-6">
          <Link
            href={pageUrl(page - 1)}
            aria-disabled={page === 1}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              page === 1
                ? "text-gray-600 pointer-events-none"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            ← Prev
          </Link>

          {pageNumbers(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`ellipsis-${i}`} className="px-2 text-gray-600 text-sm select-none">…</span>
            ) : (
              <Link
                key={p}
                href={pageUrl(p)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors ${
                  p === page
                    ? "bg-blue-600 text-white font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {p}
              </Link>
            )
          )}

          <Link
            href={pageUrl(page + 1)}
            aria-disabled={page === totalPages}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              page === totalPages
                ? "text-gray-600 pointer-events-none"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}

// Returns page numbers with nulls for ellipsis gaps: [1, null, 4, 5, 6, null, 12]
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | null)[] = [1];
  if (current > 3) pages.push(null);
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push(null);
  pages.push(total);
  return pages;
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
