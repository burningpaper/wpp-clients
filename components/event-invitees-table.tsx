"use client";

import { useTransition, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Download } from "lucide-react";
import {
  updateInviteeStatus,
  toggleAttended,
  removeInvitee,
} from "@/app/(app)/events/actions";
import { ExportModal } from "@/components/export-modal";

export type Invitee = {
  id: string;
  inviteStatus: string | null;
  rsvpStatus: string | null;
  attended: boolean;
  notes: string | null;
  contactId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  company: string | null;
  mobileNumber: string | null;
  city: string | null;
  country: string | null;
  orgName: string | null;
  agencyNames: string[];
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

const RSVP_COLOUR: Record<string, string> = {
  accepted: "text-green-400",
  accepted_on_their_behalf: "text-green-400",
  pending: "text-yellow-400/80",
  declined: "text-red-400/80",
  cancelled: "text-red-400/80",
  no_show: "text-red-400/80",
  bounced: "text-gray-500",
  error: "text-orange-400/80",
};

type SortKey = "firstName" | "lastName" | "company" | "inviteStatus" | "rsvpStatus";

const SORT_LABELS: Record<SortKey, string> = {
  firstName: "First name",
  lastName: "Surname",
  company: "Company",
  inviteStatus: "Invite status",
  rsvpStatus: "RSVP",
};

function sortValue(inv: Invitee, key: SortKey): string {
  if (key === "inviteStatus") return inv.inviteStatus ?? "zzz";
  if (key === "rsvpStatus") return inv.rsvpStatus ?? "zzz";
  if (key === "lastName") return inv.lastName.toLowerCase();
  if (key === "company") return (inv.orgName ?? inv.company ?? "zzz").toLowerCase();
  return inv.firstName.toLowerCase();
}

export function EventInviteesTable({
  invitees,
  eventId,
  eventName,
}: {
  invitees: Invitee[];
  eventId: string;
  eventName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sortBy, setSortBy] = useState<SortKey>("firstName");
  const [filterInvite, setFilterInvite] = useState<string>("all");
  const [exportOpen, setExportOpen] = useState(false);

  const filtered = useMemo(
    () => filterInvite === "all" ? invitees : invitees.filter((i) => i.inviteStatus === filterInvite),
    [invitees, filterInvite]
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => sortValue(a, sortBy).localeCompare(sortValue(b, sortBy))),
    [filtered, sortBy]
  );

  function handleStatus(
    inviteeId: string,
    field: "invite_status" | "rsvp_status",
    value: string
  ) {
    startTransition(async () => {
      await updateInviteeStatus(inviteeId, eventId, field, value);
      router.refresh();
    });
  }

  function handleAttended(inviteeId: string, attended: boolean) {
    startTransition(async () => {
      await toggleAttended(inviteeId, eventId, attended);
      router.refresh();
    });
  }

  function handleRemove(inviteeId: string) {
    startTransition(async () => {
      await removeInvitee(inviteeId, eventId);
      router.refresh();
    });
  }

  return (
    <>
    {exportOpen && (
      <ExportModal
        invitees={invitees}
        eventName={eventName}
        onClose={() => setExportOpen(false)}
      />
    )}
    <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-medium text-base">
          Invitees
          <span className="text-gray-500 font-normal text-sm ml-2">
            ({filterInvite === "all" ? invitees.length : `${sorted.length} of ${invitees.length}`})
          </span>
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">Invite status</span>
            <select
              value={filterInvite}
              onChange={(e) => setFilterInvite(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All</option>
              {Object.entries(INVITE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>{SORT_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-700/80">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">
                Contact
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-44">
                Invite status
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-44">
                RSVP
              </th>
              <th className="text-center text-xs font-medium text-gray-500 px-4 py-3 w-32">
                Attended
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-48">
                Inviting agencies
              </th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {sorted.map((inv) => (
              <tr key={inv.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 min-w-0">
                  <Link
                    href={`/contacts/${inv.contactId}?from=/events/${eventId}`}
                    className="group/link block min-w-0"
                  >
                    <p className="text-white text-sm font-medium group-hover/link:text-blue-400 transition-colors truncate">
                      {inv.firstName} {inv.lastName}
                    </p>
                    <p className="text-xs mt-0.5 truncate">
                      {inv.title && (
                        <span className="text-gray-500">{inv.title} · </span>
                      )}
                      <span className="text-gray-300">
                        {inv.orgName ?? inv.company ?? ""}
                      </span>
                    </p>
                  </Link>
                </td>

                <td className="px-4 py-3">
                  <select
                    value={inv.inviteStatus ?? ""}
                    onChange={(e) =>
                      handleStatus(inv.id, "invite_status", e.target.value)
                    }
                    className="bg-gray-700/80 border border-gray-600 text-gray-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="">—</option>
                    {Object.entries(INVITE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3">
                  <select
                    value={inv.rsvpStatus ?? ""}
                    onChange={(e) =>
                      handleStatus(inv.id, "rsvp_status", e.target.value)
                    }
                    className={`bg-gray-700/80 border border-gray-600 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer ${RSVP_COLOUR[inv.rsvpStatus ?? ""] ?? "text-gray-200"}`}
                  >
                    <option value="" className="text-gray-200">—</option>
                    {Object.entries(RSVP_LABELS).map(([val, label]) => (
                      <option key={val} value={val} className="text-gray-200">
                        {label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={inv.attended}
                    onChange={(e) => handleAttended(inv.id, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 cursor-pointer accent-blue-500"
                    title="Mark as attended"
                  />
                </td>

                <td className="px-4 py-3">
                  {inv.agencyNames.length > 0 ? (
                    <span className="text-gray-400 text-xs">
                      {inv.agencyNames.join(", ")}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleRemove(inv.id)}
                    title="Remove from event"
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
