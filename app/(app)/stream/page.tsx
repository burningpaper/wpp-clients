import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { eventYears, eventYearParticipations } from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import Link from "next/link";
import { Users, CheckCircle2, Clock, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StreamPage() {
  await requireAuth();

  const rows = await db
    .select({
      id: eventYears.id,
      year: eventYears.year,
      isCurrent: eventYears.isCurrent,
      total: count(eventYearParticipations.id),
      accepted: sql<number>`COUNT(CASE WHEN ${eventYearParticipations.rsvpStatus} IN ('accepted','accepted_on_their_behalf') THEN 1 END)::int`,
      pending: sql<number>`COUNT(CASE WHEN ${eventYearParticipations.rsvpStatus} = 'pending' THEN 1 END)::int`,
      declined: sql<number>`COUNT(CASE WHEN ${eventYearParticipations.rsvpStatus} IN ('declined','cancelled','no_show') THEN 1 END)::int`,
    })
    .from(eventYears)
    .leftJoin(
      eventYearParticipations,
      eq(eventYears.id, eventYearParticipations.eventYearId)
    )
    .groupBy(eventYears.id)
    .orderBy(sql`${eventYears.year} DESC`);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-semibold">WPP Stream</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Historical event years and invitee management
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {rows.map((row) => {
          const acceptanceRate =
            row.total > 0
              ? Math.round((row.accepted / row.total) * 100)
              : 0;

          return (
            <Link
              key={row.id}
              href={`/stream/${row.year}`}
              className="flex items-center gap-6 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-xl px-6 py-4 transition-all group"
            >
              {/* Year + current badge */}
              <div className="w-20 shrink-0">
                <p className="text-white font-bold text-2xl group-hover:text-blue-400 transition-colors">
                  {row.year}
                </p>
                {row.isCurrent && (
                  <span className="text-xs text-blue-400 font-medium">
                    Current
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 flex-1">
                <StatPill
                  icon={<Users className="w-3.5 h-3.5" />}
                  value={row.total}
                  label="invited"
                  colour="text-gray-300"
                />
                <StatPill
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  value={row.accepted}
                  label="confirmed"
                  colour="text-green-400"
                />
                <StatPill
                  icon={<Clock className="w-3.5 h-3.5" />}
                  value={row.pending}
                  label="pending"
                  colour="text-yellow-400"
                />
                <StatPill
                  icon={<XCircle className="w-3.5 h-3.5" />}
                  value={row.declined}
                  label="declined"
                  colour="text-red-400"
                />
              </div>

              {/* Acceptance bar */}
              {row.total > 0 && (
                <div className="w-32 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500 text-xs">Acceptance</span>
                    <span className="text-gray-400 text-xs font-medium">
                      {acceptanceRate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${acceptanceRate}%` }}
                    />
                  </div>
                </div>
              )}

              {row.total === 0 && (
                <span className="text-gray-600 text-sm shrink-0">No data yet</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
  colour,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  colour: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${colour}`}>
      {icon}
      <span className="font-semibold text-sm">{value}</span>
      <span className="text-gray-500 text-xs">{label}</span>
    </div>
  );
}
