import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { events, eventInvitees } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import Link from "next/link";
import { Plus, CalendarDays, MapPin, Users } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function EventsPage() {
  await requireAuth();

  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      venue: events.venue,
      eventDate: events.eventDate,
      capacity: events.capacity,
      isActive: events.isActive,
      inviteeCount: count(eventInvitees.id),
    })
    .from(events)
    .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
    .groupBy(events.id)
    .orderBy(events.eventDate);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold">Events</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {rows.length} event{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/events/new"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New event
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No events yet.{" "}
          <Link
            href="/events/new"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Create the first one.
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/events/${row.id}`}
              className="flex items-center gap-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg px-4 py-4 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-blue-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors">
                  {row.name}
                </p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {row.venue && (
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      <MapPin className="w-3 h-3" />
                      {row.venue}
                    </span>
                  )}
                  {row.eventDate && (
                    <span className="text-gray-500 text-xs">
                      {formatDate(row.eventDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <Users className="w-4 h-4" />
                  {row.inviteeCount}
                  {row.capacity ? (
                    <span className="text-gray-600">/ {row.capacity}</span>
                  ) : null}
                </span>
                {!row.isActive && (
                  <span className="text-xs text-gray-600 bg-gray-700/60 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
