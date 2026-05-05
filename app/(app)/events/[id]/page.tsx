import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { events, eventInvitees, contacts, organisations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, Users, Plus } from "lucide-react";
import { EventInviteesTable } from "@/components/event-invitees-table";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function EventDetailPage({ params }: Params) {
  await requireAuth();
  const { id } = await params;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!event) notFound();

  const invitees = await db
    .select({
      id: eventInvitees.id,
      inviteStatus: eventInvitees.inviteStatus,
      rsvpStatus: eventInvitees.rsvpStatus,
      notes: eventInvitees.notes,
      contactId: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      email: contacts.email,
      company: contacts.company,
      orgName: organisations.name,
    })
    .from(eventInvitees)
    .innerJoin(contacts, eq(eventInvitees.contactId, contacts.id))
    .leftJoin(organisations, eq(contacts.orgId, organisations.id))
    .where(eq(eventInvitees.eventId, id))
    .orderBy(contacts.firstName, contacts.lastName);

  const confirmedCount = invitees.filter(
    (i) => i.rsvpStatus === "accepted" || i.rsvpStatus === "accepted_on_their_behalf"
  ).length;
  const pendingCount = invitees.filter(
    (i) => i.rsvpStatus === "pending"
  ).length;
  const declinedCount = invitees.filter(
    (i) => i.rsvpStatus === "declined" || i.rsvpStatus === "cancelled" || i.rsvpStatus === "no_show"
  ).length;

  return (
    <div>
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to events
      </Link>

      {/* Event header card */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-white text-2xl font-semibold">{event.name}</h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {event.venue && (
                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {event.venue}
                </span>
              )}
              {event.eventDate && (
                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  {formatDate(event.eventDate)}
                </span>
              )}
              {event.capacity && (
                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <Users className="w-4 h-4 shrink-0" />
                  Capacity: {event.capacity}
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-gray-500 text-sm mt-3 max-w-2xl">
                {event.description}
              </p>
            )}
          </div>

          <Link
            href={`/events/${id}/add-invitees`}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add invitees
          </Link>
        </div>

        {/* RSVP summary bar */}
        <div className="flex items-center gap-6 mt-5 pt-4 border-t border-gray-700">
          <div>
            <p className="text-white font-semibold text-xl leading-none">
              {invitees.length}
            </p>
            <p className="text-gray-500 text-xs mt-1">Invited</p>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div>
            <p className="text-green-400 font-semibold text-xl leading-none">
              {confirmedCount}
            </p>
            <p className="text-gray-500 text-xs mt-1">Confirmed</p>
          </div>
          <div>
            <p className="text-yellow-400 font-semibold text-xl leading-none">
              {pendingCount}
            </p>
            <p className="text-gray-500 text-xs mt-1">Pending</p>
          </div>
          <div>
            <p className="text-red-400 font-semibold text-xl leading-none">
              {declinedCount}
            </p>
            <p className="text-gray-500 text-xs mt-1">Declined</p>
          </div>
          {event.capacity && invitees.length > 0 && (
            <>
              <div className="w-px h-8 bg-gray-700" />
              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500 text-xs">Capacity</span>
                  <span className="text-gray-400 text-xs">
                    {invitees.length} / {event.capacity}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (invitees.length / event.capacity) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Invitees */}
      {invitees.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No invitees yet.{" "}
          <Link
            href={`/events/${id}/add-invitees`}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add from contacts.
          </Link>
        </div>
      ) : (
        <EventInviteesTable invitees={invitees} eventId={id} />
      )}
    </div>
  );
}
