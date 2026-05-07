"use client";

import { useState, useMemo } from "react";
import { X, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import type { Invitee } from "@/components/event-invitees-table";

// ── Labels ──────────────────────────────────────────────────────────────────

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

// ── Field definitions ────────────────────────────────────────────────────────

type FieldKey =
  | "firstName"
  | "lastName"
  | "title"
  | "company"
  | "email"
  | "mobileNumber"
  | "city"
  | "country"
  | "inviteStatus"
  | "rsvpStatus"
  | "agencyNames"
  | "notes";

const FIELDS: { key: FieldKey; label: string; defaultOn: boolean }[] = [
  { key: "firstName",    label: "First name",       defaultOn: true  },
  { key: "lastName",     label: "Last name",        defaultOn: true  },
  { key: "title",        label: "Job title",        defaultOn: true  },
  { key: "company",      label: "Company",          defaultOn: true  },
  { key: "email",        label: "Email",            defaultOn: true  },
  { key: "mobileNumber", label: "Mobile",           defaultOn: false },
  { key: "city",         label: "City",             defaultOn: false },
  { key: "country",      label: "Country",          defaultOn: false },
  { key: "inviteStatus", label: "Invite status",    defaultOn: true  },
  { key: "rsvpStatus",   label: "RSVP status",      defaultOn: true  },
  { key: "agencyNames",  label: "Inviting agencies",defaultOn: true  },
  { key: "notes",        label: "Notes",            defaultOn: false },
];

const RSVP_FILTER_OPTIONS = [
  { value: "all",                    label: "All" },
  { value: "accepted",               label: "Accepted" },
  { value: "accepted_on_their_behalf", label: "Accepted (proxy)" },
  { value: "pending",                label: "Pending" },
  { value: "declined",               label: "Declined" },
  { value: "cancelled",              label: "Cancelled" },
  { value: "bounced",                label: "Bounced" },
  { value: "no_show",                label: "No Show" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveValue(inv: Invitee, key: FieldKey): string {
  switch (key) {
    case "firstName":    return inv.firstName;
    case "lastName":     return inv.lastName;
    case "title":        return inv.title ?? "";
    case "company":      return inv.orgName ?? inv.company ?? "";
    case "email":        return inv.email ?? "";
    case "mobileNumber": return inv.mobileNumber ?? "";
    case "city":         return inv.city ?? "";
    case "country":      return inv.country ?? "";
    case "inviteStatus": return inv.inviteStatus ? (INVITE_LABELS[inv.inviteStatus] ?? inv.inviteStatus) : "";
    case "rsvpStatus":   return inv.rsvpStatus ? (RSVP_LABELS[inv.rsvpStatus] ?? inv.rsvpStatus) : "";
    case "agencyNames":  return inv.agencyNames.join(", ");
    case "notes":        return inv.notes ?? "";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  invitees: Invitee[];
  eventName: string;
  onClose: () => void;
};

export function ExportModal({ invitees, eventName, onClose }: Props) {
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(
    () => new Set(FIELDS.filter((f) => f.defaultOn).map((f) => f.key))
  );
  const [rsvpFilter, setRsvpFilter] = useState<string>("all");

  const filtered = useMemo(
    () =>
      rsvpFilter === "all"
        ? invitees
        : invitees.filter((i) => i.rsvpStatus === rsvpFilter),
    [invitees, rsvpFilter]
  );

  function toggleField(key: FieldKey) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleExport() {
    const orderedFields = FIELDS.filter((f) => selectedFields.has(f.key));

    const rows = filtered.map((inv) => {
      const row: Record<string, string> = {};
      for (const { key, label } of orderedFields) {
        row[label] = resolveValue(inv, key);
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns based on content
    const colWidths = orderedFields.map(({ label }) => {
      const maxLen = Math.max(
        label.length,
        ...rows.map((r) => (r[label] ?? "").length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendees");

    const safeEvent = eventName.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
    const rsvpSuffix = rsvpFilter === "all" ? "" : `_${rsvpFilter}`;
    XLSX.writeFile(wb, `${safeEvent}${rsvpSuffix}_attendees.xlsx`);

    onClose();
  }

  // Backdrop click closes modal
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const canExport = selectedFields.size > 0 && filtered.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-4.5 h-4.5 text-green-400" />
            <h2 className="text-white font-semibold">Export attendees</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* RSVP filter */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Filter by RSVP status
            </p>
            <div className="flex flex-wrap gap-2">
              {RSVP_FILTER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setRsvpFilter(value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    rsvpFilter === value
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                  }`}
                >
                  {label}
                  {value !== "all" && (
                    <span className="ml-1.5 text-gray-400 font-normal">
                      {invitees.filter((i) => i.rsvpStatus === value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Field selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Fields to export
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedFields(new Set(FIELDS.map((f) => f.key)))}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Select all
                </button>
                <span className="text-gray-700">·</span>
                <button
                  onClick={() => setSelectedFields(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {FIELDS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div
                    onClick={() => toggleField(key)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      selectedFields.has(key)
                        ? "bg-blue-600 border-blue-500"
                        : "bg-gray-800 border-gray-600 group-hover:border-gray-400"
                    }`}
                  >
                    {selectedFields.has(key) && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => toggleField(key)}
                    className="text-sm text-gray-300 group-hover:text-white transition-colors select-none"
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <p className="text-gray-500 text-sm">
            {filtered.length === 0 ? (
              <span className="text-amber-400">No contacts match this filter</span>
            ) : (
              <>
                <span className="text-white font-medium">{filtered.length}</span>{" "}
                contact{filtered.length !== 1 ? "s" : ""} will be exported
              </>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export to Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
