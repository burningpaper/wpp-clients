"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { StrengthBadge } from "@/components/strength-badge";

type Relationship = {
  agencyId: string;
  agencyName: string;
  relationshipStrength: "cold" | "warm" | "strong";
  associationType: "client_of" | "ex_client_of" | "other" | null;
};

type Agency = {
  id: string;
  name: string;
};

type Props = {
  contactId: string;
  relationships: Relationship[];
  allAgencies: Agency[];
  userRole: string;
  userAgencyId: string | null;
};

const ASSOC_LABELS: Record<string, string> = {
  client_of: "Client of",
  ex_client_of: "Ex-client of",
  other: "Other",
};

const ASSOC_COLOURS: Record<string, string> = {
  client_of: "text-blue-400 bg-blue-400/10 border border-blue-400/20",
  ex_client_of: "text-gray-400 bg-gray-700 border border-gray-600",
  other: "text-purple-400 bg-purple-400/10 border border-purple-400/20",
};

function AssocBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${ASSOC_COLOURS[type] ?? ASSOC_COLOURS.other}`}>
      {ASSOC_LABELS[type] ?? type}
    </span>
  );
}

export function AgencyRelationships({
  contactId,
  relationships: initial,
  allAgencies,
  userRole,
  userAgencyId,
}: Props) {
  const router = useRouter();
  const [relationships, setRelationships] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userRole === "ceo_md" || userRole === "system_admin";
  const canAdd = isAdmin || !!userAgencyId;

  const [agencyId, setAgencyId] = useState(
    !isAdmin && userAgencyId ? userAgencyId : ""
  );
  const [assocType, setAssocType] = useState<"client_of" | "ex_client_of" | "other">("client_of");
  const [strength, setStrength] = useState<"cold" | "warm" | "strong">("cold");

  function resetForm() {
    setAgencyId(!isAdmin && userAgencyId ? userAgencyId : "");
    setAssocType("client_of");
    setStrength("cold");
    setError(null);
  }

  function openAdd() {
    resetForm();
    setAdding(true);
  }

  function cancelAdd() {
    setAdding(false);
    setError(null);
  }

  async function handleSave() {
    if (!agencyId) { setError("Select an agency"); return; }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/contact_agency_relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        agencyId,
        relationshipStrength: strength,
        associationType: assocType,
      }),
    });

    setSaving(false);

    if (res.ok) {
      const agency = allAgencies.find((a) => a.id === agencyId);
      const newRel: Relationship = {
        agencyId,
        agencyName: agency?.name ?? agencyId,
        relationshipStrength: strength,
        associationType: assocType,
      };
      setRelationships((prev) => {
        const existing = prev.findIndex((r) => r.agencyId === agencyId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newRel;
          return updated;
        }
        return [...prev, newRel];
      });
      setAdding(false);
      resetForm();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
    }
  }

  // Available agencies for the dropdown — exclude already-linked agencies for new adds
  const existingAgencyIds = new Set(relationships.map((r) => r.agencyId));
  const availableAgencies = allAgencies.filter(
    (a) => !existingAgencyIds.has(a.id)
  );

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-medium text-sm">Agency relationships</h2>
        {canAdd && !adding && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-200 text-xs border border-gray-700 hover:border-gray-500 px-2 py-1 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {relationships.length === 0 && !adding ? (
        <p className="text-gray-500 text-sm">No relationships yet.</p>
      ) : (
        <div className="space-y-2.5">
          {relationships.map((r) => (
            <div key={r.agencyId} className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-gray-300 text-sm truncate">{r.agencyName}</span>
                {r.associationType && (
                  <AssocBadge type={r.associationType} />
                )}
              </div>
              <StrengthBadge strength={r.relationshipStrength} />
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2.5">
          {/* Agency selector — locked for non-admins */}
          {isAdmin ? (
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Agency</label>
              <select
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select agency…</option>
                {availableAgencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Agency</label>
              <p className="text-gray-300 text-sm">
                {allAgencies.find((a) => a.id === userAgencyId)?.name ?? "Your agency"}
              </p>
            </div>
          )}

          {/* Association type */}
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Association</label>
            <select
              value={assocType}
              onChange={(e) => setAssocType(e.target.value as typeof assocType)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="client_of">Client of</option>
              <option value="ex_client_of">Ex-client of</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Relationship strength */}
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Relationship strength</label>
            <select
              value={strength}
              onChange={(e) => setStrength(e.target.value as typeof strength)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="cold">Cold</option>
              <option value="warm">Warm</option>
              <option value="strong">Strong</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancelAdd}
              className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
