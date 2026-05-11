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
  eventInvitees,
  events,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { IntelligenceNotesList } from "@/components/intelligence-notes-list";
import { AddNoteForm } from "@/components/add-note-form";
import { ContactHeader } from "@/components/contact-header";
import { AgencyRelationships } from "@/components/agency-relationships";

export const dynamic = "force-dynamic";

const INVITE_LABELS: Record<string, string> = {
  first_round_invite: "1st Round",
  second_round_invite: "2nd Round",
  third_round_invite: "3rd Round",
  agency_invite: "Agency",
  rising_star_invite: "Rising Star",
  waiting_list: "Waitlist",
  other_invite: "Other",
  no: "Not Invited",
};

const RSVP_LABELS: Record<string, string> = {
  accepted: "Accepted",
  accepted_on_their_behalf: "Accepted (proxy)",
  pending: "Pending",
  declined: "Declined",
  cancelled: "Cancelled",
  bounced: "Bounced",
  no_show: "No Show",
  error: "Error",
};

function InviteStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <span className="text-gray-300 text-xs bg-gray-700 px-2 py-0.5 rounded-full">
      {INVITE_LABELS[status] ?? status}
    </span>
  );
}

function RsvpStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-600 text-xs">—</span>;
  const colour =
    status === "accepted" || status === "accepted_on_their_behalf"
      ? "text-green-400 bg-green-400/10"
      : status === "pending"
      ? "text-yellow-400 bg-yellow-400/10"
      : status === "declined" || status === "cancelled" || status === "no_show"
      ? "text-red-400 bg-red-400/10"
      : "text-gray-400 bg-gray-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colour}`}>
      {RSVP_LABELS[status] ?? status}
    </span>
  );
}

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

export default async function ContactDetailPage({ params, searchParams }: Params) {
  const user = await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;

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
      associationType: contactAgencyRelationships.associationType,
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

  const allAgencies = await db.select().from(agencies).orderBy(agencies.name);

  const eventParticipations = await db
    .select({
      inviteeId: eventInvitees.id,
      inviteStatus: eventInvitees.inviteStatus,
      rsvpStatus: eventInvitees.rsvpStatus,
      eventId: events.id,
      eventName: events.name,
      isCurrent: events.isCurrent,
    })
    .from(eventInvitees)
    .innerJoin(events, eq(eventInvitees.eventId, events.id))
    .where(eq(eventInvitees.contactId, id))
    .orderBy(desc(events.name));

  const canEdit =
    user.role === "ceo_md" ||
    user.role === "system_admin" ||
    relationships.some((r) => r.agencyId === user.agencyId);

  const noteAgencyMap = new Map(allAgencies.map((a) => [a.id, a.name]));

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <Link
        href={from ?? "/contacts"}
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {from?.startsWith("/events/") ? "Back to event" : "Back to contacts"}
      </Link>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: contact header + event participation + notes */}
        <div className="col-span-2 space-y-5">
          <ContactHeader
            contact={contact}
            org={org ?? null}
            tags={contactTagRows}
            canEdit={canEdit}
          />

          {/* Event participation */}
          {eventParticipations.length > 0 && (
            <div>
              <h2 className="text-white font-medium text-base mb-3">
                Event participation
                <span className="text-gray-500 font-normal text-sm ml-2">
                  ({eventParticipations.length})
                </span>
              </h2>
              <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-gray-700/80">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">
                        Event
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-36">
                        Invite
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-36">
                        RSVP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/40">
                    {eventParticipations.map((ep) => (
                      <tr
                        key={ep.inviteeId}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3 min-w-0">
                          <Link
                            href={`/events/${ep.eventId}`}
                            className="flex items-center gap-2 group/link min-w-0"
                          >
                            <CalendarDays className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span className="text-white text-sm group-hover/link:text-blue-400 transition-colors truncate">
                              {ep.eventName}
                            </span>
                            {ep.isCurrent && (
                              <span className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-1.5 py-0.5 rounded-full shrink-0">
                                Current
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <InviteStatusBadge status={ep.inviteStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <RsvpStatusBadge status={ep.rsvpStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

        {/* Right column: agency relationships */}
        <div className="space-y-5">
          <AgencyRelationships
            contactId={id}
            relationships={relationships}
            allAgencies={allAgencies}
            userRole={user.role}
            userAgencyId={user.agencyId ?? null}
          />
        </div>
      </div>
    </div>
  );
}
