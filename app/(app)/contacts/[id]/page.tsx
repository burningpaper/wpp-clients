import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  contacts,
  organisations,
  contactAgencyRelationships,
  agencies,
  intelligenceNotes,
  contactTags,
  tags,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Mail, Briefcase, Clock } from "lucide-react";
import { StrengthBadge } from "@/components/strength-badge";
import { IntelligenceNotesList } from "@/components/intelligence-notes-list";
import { AddNoteForm } from "@/components/add-note-form";
import { EditContactForm } from "@/components/edit-contact-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function ContactDetailPage({ params }: Params) {
  const user = await requireAuth();
  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) notFound();

  const [org] = contact.orgId
    ? await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, contact.orgId))
        .limit(1)
    : [null];

  const relationships = await db
    .select({
      agencyId: contactAgencyRelationships.agencyId,
      agencyName: agencies.name,
      relationshipStrength: contactAgencyRelationships.relationshipStrength,
      lastContactDate: contactAgencyRelationships.lastContactDate,
      relationshipOwnerId: contactAgencyRelationships.relationshipOwnerId,
    })
    .from(contactAgencyRelationships)
    .innerJoin(agencies, eq(contactAgencyRelationships.agencyId, agencies.id))
    .where(eq(contactAgencyRelationships.contactId, id));

  const allNotes = await db
    .select()
    .from(intelligenceNotes)
    .where(eq(intelligenceNotes.contactId, id))
    .orderBy(intelligenceNotes.createdAt);

  const visibleNotes = allNotes.filter((n) => {
    if (n.visibility === "wpp_sa") return true;
    if (user.role === "ceo_md" || user.role === "system_admin") return true;
    return n.createdByAgencyId === user.agencyId;
  });

  const contactTagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(contactTags.contactId, id));

  const allAgencies = await db.select().from(agencies);

  const canEdit =
    user.role === "ceo_md" ||
    user.role === "system_admin" ||
    relationships.some((r) => r.agencyId === user.agencyId);

  const agencyNoteCreatorIds = [
    ...new Set(allNotes.map((n) => n.createdByAgencyId)),
  ];
  const noteAgencyMap = new Map(allAgencies.map((a) => [a.id, a.name]));

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to contacts
      </Link>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: contact info */}
        <div className="col-span-2 space-y-5">
          {/* Header card */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-700 flex items-center justify-center shrink-0">
                <span className="text-white text-xl font-semibold">
                  {contact.firstName[0]}
                  {contact.lastName[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-white text-xl font-semibold">
                  {contact.firstName} {contact.lastName}
                </h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {contact.title && (
                    <span className="flex items-center gap-1 text-gray-400 text-sm">
                      <Briefcase className="w-3.5 h-3.5" />
                      {contact.title}
                    </span>
                  )}
                  {org ? (
                    <Link
                      href={`/organisations/${org.id}`}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      {org.name}
                    </Link>
                  ) : contact.company ? (
                    <span className="flex items-center gap-1 text-gray-400 text-sm">
                      <Building2 className="w-3.5 h-3.5" />
                      {contact.company}
                    </span>
                  ) : null}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1 text-gray-400 hover:text-gray-300 text-sm transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {contact.email}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-gray-500 text-xs">
                  <Clock className="w-3 h-3" />
                  Last updated{" "}
                  {contact.lastUpdated.toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>

            {/* Tags */}
            {contactTagRows.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-700">
                {contactTagRows.map((t) => (
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

          {/* Intelligence notes */}
          <div>
            <h2 className="text-white font-medium text-base mb-3">
              Intelligence notes
              <span className="text-gray-500 font-normal text-sm ml-2">
                ({visibleNotes.length})
              </span>
            </h2>
            <IntelligenceNotesList
              notes={visibleNotes}
              agencyMap={Object.fromEntries(noteAgencyMap)}
              currentUserRole={user.role}
            />
            {user.agencyId && (
              <AddNoteForm contactId={id} agencyId={user.agencyId} />
            )}
          </div>
        </div>

        {/* Right column: relationships + edit */}
        <div className="space-y-5">
          {/* Agency relationships */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <h2 className="text-white font-medium text-sm mb-3">
              Agency relationships
            </h2>
            {relationships.length === 0 ? (
              <p className="text-gray-500 text-sm">No relationships yet.</p>
            ) : (
              <div className="space-y-2.5">
                {relationships.map((r) => (
                  <div
                    key={r.agencyId}
                    className="flex items-center justify-between"
                  >
                    <span className="text-gray-300 text-sm">
                      {r.agencyName}
                    </span>
                    <StrengthBadge strength={r.relationshipStrength} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit form */}
          {canEdit && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <h2 className="text-white font-medium text-sm mb-3">
                Edit contact
              </h2>
              <EditContactForm
                contact={contact}
                agencies={allAgencies}
                relationships={relationships}
                currentUserAgencyId={user.agencyId}
                currentUserRole={user.role}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
