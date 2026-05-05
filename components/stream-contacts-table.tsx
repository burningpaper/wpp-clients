"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search, X } from "lucide-react";

type Row = {
  participationId: string;
  contactId: string;
  firstName: string;
  lastName: string;
  company: string | null;
  position: string | null;
  category: string | null;
  email: string | null;
  inviteStatus: string | null;
  rsvpStatus: string | null;
  nominated: boolean;
  priority: string | null;
  nominator: string | null;
};

const RSVP_COLOUR: Record<string, string> = {
  accepted: "text-green-400 bg-green-400/10",
  accepted_on_their_behalf: "text-green-400 bg-green-400/10",
  pending: "text-yellow-400 bg-yellow-400/10",
  declined: "text-red-400 bg-red-400/10",
  cancelled: "text-red-400/70 bg-red-400/10",
  no_show: "text-red-400/70 bg-red-400/10",
  bounced: "text-orange-400 bg-orange-400/10",
  error: "text-orange-400 bg-orange-400/10",
};

const INVITE_COLOUR: Record<string, string> = {
  first_round_invite: "text-blue-400 bg-blue-400/10",
  second_round_invite: "text-blue-300/80 bg-blue-400/10",
  third_round_invite: "text-blue-300/60 bg-blue-400/10",
  agency_invite: "text-purple-400 bg-purple-400/10",
  rising_star_invite: "text-pink-400 bg-pink-400/10",
  waiting_list: "text-yellow-400 bg-yellow-400/10",
  other_invite: "text-gray-400 bg-gray-400/10",
  no: "text-gray-600 bg-gray-700/40",
};

export function StreamContactsTable({
  rows,
  year,
  eventYearId,
  inviteLabels,
  rsvpLabels,
  categoryLabels,
  currentFilters,
}: {
  rows: Row[];
  year: number;
  eventYearId: string;
  inviteLabels: Record<string, string>;
  rsvpLabels: Record<string, string>;
  categoryLabels: Record<string, string>;
  currentFilters: { q?: string; invite?: string; rsvp?: string; category?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const hasFilters =
    !!currentFilters.q ||
    !!currentFilters.invite ||
    !!currentFilters.rsvp ||
    !!currentFilters.category;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;
              setFilter("q", val || undefined);
            }}
          >
            <input
              name="q"
              defaultValue={currentFilters.q ?? ""}
              placeholder="Search name or company…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </form>
        </div>

        {/* Category filter */}
        <select
          value={currentFilters.category ?? ""}
          onChange={(e) => setFilter("category", e.target.value || undefined)}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All categories</option>
          {Object.entries(categoryLabels).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        {/* Invite status filter */}
        <select
          value={currentFilters.invite ?? ""}
          onChange={(e) => setFilter("invite", e.target.value || undefined)}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All invite statuses</option>
          {Object.entries(inviteLabels).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        {/* RSVP filter */}
        <select
          value={currentFilters.rsvp ?? ""}
          onChange={(e) => setFilter("rsvp", e.target.value || undefined)}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All RSVP statuses</option>
          {Object.entries(rsvpLabels).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-2"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-gray-500 text-xs mb-3">
        {rows.length} contact{rows.length !== 1 ? "s" : ""}
        {hasFilters ? " (filtered)" : ""}
      </p>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          No contacts match the current filters.
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/80">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Company</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Category</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Invite</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">RSVP</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nominator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {rows.map((row) => (
                <tr
                  key={row.participationId}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">
                      {row.firstName} {row.lastName}
                    </p>
                    {row.position && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate max-w-[200px]">
                        {row.position}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-gray-400 max-w-[180px]">
                    <span className="truncate block">{row.company ?? "—"}</span>
                  </td>

                  <td className="px-4 py-3">
                    {row.category ? (
                      <span className="text-xs text-gray-400 bg-gray-700/60 px-2 py-0.5 rounded-full">
                        {categoryLabels[row.category] ?? row.category}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600 bg-gray-700/30 px-2 py-0.5 rounded-full">
                        Uncategorised
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {row.inviteStatus ? (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${INVITE_COLOUR[row.inviteStatus] ?? "text-gray-400 bg-gray-700/60"}`}
                      >
                        {inviteLabels[row.inviteStatus] ?? row.inviteStatus}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {row.rsvpStatus ? (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${RSVP_COLOUR[row.rsvpStatus] ?? "text-gray-400 bg-gray-700/60"}`}
                      >
                        {rsvpLabels[row.rsvpStatus] ?? row.rsvpStatus}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {row.nominator ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
