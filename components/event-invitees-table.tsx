"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  updateInviteeStatus,
  removeInvitee,
} from "@/app/(app)/events/actions";

type Invitee = {
  id: string;
  inviteStatus: string;
  rsvpStatus: string;
  notes: string | null;
  contactId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  orgName: string;
};

const INVITE_LABELS: Record<string, string> = {
  not_invited: "Not invited",
  invited: "Invited",
  waitlisted: "Waitlisted",
  declined: "Declined",
};

const RSVP_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  attended: "Attended",
  no_show: "No show",
};

// Colour hint for RSVP status
const RSVP_COLOUR: Record<string, string> = {
  pending: "text-yellow-400/80",
  confirmed: "text-green-400",
  attended: "text-green-400",
  declined: "text-red-400/80",
  no_show: "text-red-400/80",
};

export function EventInviteesTable({
  invitees,
  eventId,
}: {
  invitees: Invitee[];
  eventId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  function handleRemove(inviteeId: string) {
    startTransition(async () => {
      await removeInvitee(inviteeId, eventId);
      router.refresh();
    });
  }

  return (
    <div className={isPending ? "opacity-60 pointer-events-none" : ""}>
      <h2 className="text-white font-medium text-base mb-3">
        Invitees
        <span className="text-gray-500 font-normal text-sm ml-2">
          ({invitees.length})
        </span>
      </h2>

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700/80">
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-1/2">
                Contact
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">
                Invite status
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">
                RSVP
              </th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {invitees.map((inv) => (
              <tr key={inv.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/contacts/${inv.contactId}`}
                    className="group/link"
                  >
                    <p className="text-white text-sm font-medium group-hover/link:text-blue-400 transition-colors">
                      {inv.firstName} {inv.lastName}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5 truncate">
                      {inv.title ? `${inv.title} · ` : ""}
                      {inv.orgName}
                    </p>
                  </Link>
                </td>

                <td className="px-4 py-3">
                  <select
                    value={inv.inviteStatus}
                    onChange={(e) =>
                      handleStatus(inv.id, "invite_status", e.target.value)
                    }
                    className="bg-gray-700/80 border border-gray-600 text-gray-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    {Object.entries(INVITE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3">
                  <select
                    value={inv.rsvpStatus}
                    onChange={(e) =>
                      handleStatus(inv.id, "rsvp_status", e.target.value)
                    }
                    className={`bg-gray-700/80 border border-gray-600 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer ${RSVP_COLOUR[inv.rsvpStatus] ?? "text-gray-200"}`}
                  >
                    {Object.entries(RSVP_LABELS).map(([val, label]) => (
                      <option key={val} value={val} className="text-gray-200">
                        {label}
                      </option>
                    ))}
                  </select>
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
  );
}
