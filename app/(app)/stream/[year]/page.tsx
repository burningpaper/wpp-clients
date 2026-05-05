import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  eventYears,
  eventYearParticipations,
  streamContacts,
  participationAgencies,
} from "@/db/schema";
import { eq, and, ilike, or, sql, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, CheckCircle2, Clock, XCircle, HelpCircle } from "lucide-react";
import { StreamContactsTable } from "@/components/stream-contacts-table";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ year: string }>;
  searchParams: Promise<{
    q?: string;
    invite?: string;
    rsvp?: string;
    category?: string;
  }>;
};

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

const CATEGORY_LABELS: Record<string, string> = {
  client_sa: "Client SA",
  client_africa: "Client Africa",
  client_global: "Client Global",
  industry_sa: "Industry SA",
  industry_africa: "Industry Africa",
  industry_global: "Industry Global",
  agency_sa: "Agency SA",
  agency_africa: "Agency Africa",
  agency_global: "Agency Global",
  rising_star: "Rising Star",
};

export default async function StreamYearPage({ params, searchParams }: Params) {
  await requireAuth();
  const { year: yearStr } = await params;
  const sp = await searchParams;

  const year = parseInt(yearStr, 10);
  if (isNaN(year)) notFound();

  const [eventYear] = await db
    .select()
    .from(eventYears)
    .where(eq(eventYears.year, year))
    .limit(1);

  if (!eventYear) notFound();

  // Build contact-level filters
  const contactConditions = [isNull(streamContacts.deletedAt)];
  const q = (sp.q ?? "").trim();
  if (q.length >= 2) {
    contactConditions.push(
      or(
        ilike(streamContacts.firstName, `%${q}%`),
        ilike(streamContacts.lastName, `%${q}%`),
        ilike(streamContacts.company, `%${q}%`)
      )!
    );
  }
  if (sp.category) {
    contactConditions.push(eq(streamContacts.category, sp.category as any));
  }

  // Build participation-level filters
  const partConditions = [eq(eventYearParticipations.eventYearId, eventYear.id)];
  if (sp.invite) {
    partConditions.push(
      eq(eventYearParticipations.inviteStatus, sp.invite as any)
    );
  }
  if (sp.rsvp) {
    partConditions.push(
      eq(eventYearParticipations.rsvpStatus, sp.rsvp as any)
    );
  }

  const rows = await db
    .select({
      participationId: eventYearParticipations.id,
      contactId: streamContacts.id,
      firstName: streamContacts.firstName,
      lastName: streamContacts.lastName,
      company: streamContacts.company,
      position: streamContacts.position,
      category: streamContacts.category,
      email: streamContacts.email,
      inviteStatus: eventYearParticipations.inviteStatus,
      rsvpStatus: eventYearParticipations.rsvpStatus,
      nominated: eventYearParticipations.nominated,
      priority: eventYearParticipations.priority,
      nominator: eventYearParticipations.nominator,
    })
    .from(eventYearParticipations)
    .innerJoin(
      streamContacts,
      and(
        eq(eventYearParticipations.contactId, streamContacts.id),
        ...contactConditions
      )
    )
    .where(and(...partConditions))
    .orderBy(streamContacts.lastName, streamContacts.firstName)
    .limit(500);

  // Summary stats for this year (unfiltered)
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      accepted: sql<number>`COUNT(CASE WHEN ${eventYearParticipations.rsvpStatus} IN ('accepted','accepted_on_their_behalf') THEN 1 END)::int`,
      pending: sql<number>`COUNT(CASE WHEN ${eventYearParticipations.rsvpStatus} = 'pending' THEN 1 END)::int`,
      declined: sql<number>`COUNT(CASE WHEN ${eventYearParticipations.rsvpStatus} IN ('declined','cancelled','no_show') THEN 1 END)::int`,
      noRsvp: sql<number>`COUNT(CASE WHEN ${eventYearParticipations.rsvpStatus} IS NULL THEN 1 END)::int`,
    })
    .from(eventYearParticipations)
    .where(eq(eventYearParticipations.eventYearId, eventYear.id));

  return (
    <div>
      <Link
        href="/stream"
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All years
      </Link>

      {/* Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-white text-3xl font-bold">
            WPP Stream {year}
          </h1>
          {eventYear.isCurrent && (
            <span className="text-xs text-blue-400 font-medium bg-blue-400/10 px-2.5 py-1 rounded-full border border-blue-400/20">
              Current year
            </span>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 flex-wrap">
          <Stat icon={<Users className="w-4 h-4" />} value={stats?.total ?? 0} label="Total" colour="text-gray-300" />
          <div className="w-px h-8 bg-gray-700" />
          <Stat icon={<CheckCircle2 className="w-4 h-4" />} value={stats?.accepted ?? 0} label="Confirmed" colour="text-green-400" />
          <Stat icon={<Clock className="w-4 h-4" />} value={stats?.pending ?? 0} label="Pending" colour="text-yellow-400" />
          <Stat icon={<XCircle className="w-4 h-4" />} value={stats?.declined ?? 0} label="Declined" colour="text-red-400" />
          <Stat icon={<HelpCircle className="w-4 h-4" />} value={stats?.noRsvp ?? 0} label="No RSVP" colour="text-gray-500" />
        </div>
      </div>

      {/* Contacts table with filters */}
      <StreamContactsTable
        rows={rows}
        year={year}
        eventYearId={eventYear.id}
        inviteLabels={INVITE_LABELS}
        rsvpLabels={RSVP_LABELS}
        categoryLabels={CATEGORY_LABELS}
        currentFilters={{ q: sp.q, invite: sp.invite, rsvp: sp.rsvp, category: sp.category }}
      />
    </div>
  );
}

function Stat({
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
    <div className={`flex items-center gap-2 ${colour}`}>
      {icon}
      <span className="font-bold text-xl leading-none">{value}</span>
      <span className="text-gray-500 text-sm">{label}</span>
    </div>
  );
}
