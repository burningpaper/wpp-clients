import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  organisations,
  contacts,
  contactAgencyRelationships,
  agencies,
  intelligenceNotes,
  orgTags,
  tags,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { StrengthBadge } from "@/components/strength-badge";
import { IntelligenceNotesList } from "@/components/intelligence-notes-list";
import { AddNoteForm } from "@/components/add-note-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function OrganisationDetailPage({ params }: Params) {
  const user = await requireAuth();
  const { id } = await params;

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, id))
    .limit(1);

  if (!org) notFound();

  const orgContacts = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      lastUpdated: contacts.lastUpdated,
      agencyId: contactAgencyRelationships.agencyId,
      agencyName: agencies.name,
      relationshipStrength: contactAgencyRelationships.relationshipStrength,
    })
    .from(contacts)
    .leftJoin(
      contactAgencyRelationships,
      eq(contacts.id, contactAgencyRelationships.contactId)
    )
    .leftJoin(agencies, eq(contactAgencyRelationships.agencyId, agencies.id))
    .where(eq(contacts.orgId, id))
    .limit(100);

  const allNotes = await db
    .select()
    .from(intelligenceNotes)
    .where(eq(intelligenceNotes.orgId, id))
    .orderBy(intelligenceNotes.createdAt);

  const visibleNotes = allNotes.filter((n) => {
    if (n.visibility === "wpp_sa") return true;
    if (user.role === "ceo_md" || user.role === "system_admin") return true;
    return n.createdByAgencyId === user.agencyId;
  });

  const orgTagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(orgTags)
    .innerJoin(tags, eq(orgTags.tagId, tags.id))
    .where(eq(orgTags.orgId, id));

  const allAgencies = await db.select().from(agencies);
  const agencyMap = Object.fromEntries(allAgencies.map((a) => [a.id, a.name]));

  return (
    <div className="max-w-4xl">
      <Link
        href="/organisations"
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to organisations
      </Link>

      {/* Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h1 className="text-white text-xl font-semibold">{org.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {orgContacts.length} contact
              {orgContacts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {orgTagRows.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-700">
            {orgTagRows.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Contacts */}
        <div className="col-span-2">
          <h2 className="text-white font-medium text-base mb-3">
            Contacts at {org.name}
          </h2>

          {orgContacts.length === 0 ? (
            <p className="text-gray-500 text-sm">No contacts at this organisation yet.</p>
          ) : (
            <div className="space-y-2">
              {orgContacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-4 py-3 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                    <span className="text-gray-300 text-xs font-medium">
                      {c.firstName[0]}
                      {c.lastName[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm group-hover:text-blue-400 transition-colors">
                      {c.firstName} {c.lastName}
                    </p>
                    {c.title && (
                      <p className="text-gray-500 text-xs">{c.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.agencyName && (
                      <span className="text-gray-500 text-xs">
                        {c.agencyName}
                      </span>
                    )}
                    <StrengthBadge strength={c.relationshipStrength} />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Org-level notes */}
          <div className="mt-6">
            <h2 className="text-white font-medium text-base mb-3">
              Organisation notes
            </h2>
            <IntelligenceNotesList
              notes={visibleNotes}
              agencyMap={agencyMap}
              currentUserRole={user.role}
            />
            {user.agencyId && (
              <AddNoteForm orgId={id} agencyId={user.agencyId} />
            )}
          </div>
        </div>

        {/* Sidebar: agency coverage */}
        <div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <h3 className="text-white font-medium text-sm mb-3">
              Agency coverage
            </h3>
            {(() => {
              const agencyCounts = new Map<
                string,
                { name: string; count: number; maxStrength: string }
              >();
              for (const c of orgContacts) {
                if (!c.agencyId) continue;
                const existing = agencyCounts.get(c.agencyId);
                if (existing) {
                  existing.count++;
                } else {
                  agencyCounts.set(c.agencyId, {
                    name: c.agencyName ?? c.agencyId,
                    count: 1,
                    maxStrength: c.relationshipStrength ?? "cold",
                  });
                }
              }
              if (agencyCounts.size === 0)
                return (
                  <p className="text-gray-500 text-sm">
                    No agency relationships yet.
                  </p>
                );
              return Array.from(agencyCounts.values()).map((a) => (
                <div
                  key={a.name}
                  className="flex items-center justify-between mb-2"
                >
                  <span className="text-gray-300 text-sm">{a.name}</span>
                  <span className="text-gray-500 text-xs">
                    {a.count} contact{a.count !== 1 ? "s" : ""}
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
