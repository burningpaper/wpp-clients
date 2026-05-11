"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Check } from "lucide-react";
import { StrengthBadge } from "@/components/strength-badge";

type Relationship = {
  agencyId: string;
  agencyName: string;
  relationshipStrength: "cold" | "warm" | "strong";
  associationType: "client_of" | "ex_client_of" | "staff_of" | "other" | null;
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
  staff_of: "Staff of",
  other: "Other",
};

const ASSOC_COLOURS: Record<string, string> = {
  client_of: "text-blue-400 bg-blue-400/10 border border-blue-400/20",
  ex_client_of: "text-gray-400 bg-gray-700 border border-gray-600",
  staff_of: "text-green-400 bg-green-400/10 border border-green-400/20",
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

type EditState = {
  agencyId: string;
  assocType: "client_of" | "ex_client_of" | "staff_of" | "other";
  strength: "cold" | "warm" | "strong";
  saving: boolean;
  error: string | null;
};

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
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const isAdmin = userRole === "ceo_md" || userRole === "system_admin";
  const canAdd = isAdmin || !!userAgencyId;

  const [newAgencyId, setNewAgencyId] = useState(
    !isAdmin && userAgencyId ? userAgencyId : ""
  );
  const [newAssocType, setNewAssocType] = useState<"client_of" | "ex_client_of" | "staff_of" | "other">("client_of");
  const [newStrength, setNewStrength] = useState<"cold" | "warm" | "strong">("cold");

  function canEditRelationship(r: Relationship) {
    return isAdmin || r.agencyId === userAgencyId;
  }

  function openAdd() {
    setEditState(null);
    setNewAgencyId(!isAdmin && userAgencyId ? userAgencyId : "");
    setNewAssocType("client_of");
    setNewStrength("cold");
    setAddError(null);
    setAdding(true);
  }

  function cancelAdd() {
    setAdding(false);
    setAddError(null);
  }

  function openEdit(r: Relationship) {
    setAdding(false);
    setEditState({
      agencyId: r.agencyId,
      assocType: r.associationType ?? "other",
      strength: r.relationshipStrength,
      saving: false,
      error: null,
    });
  }

  function cancelEdit() {
    setEditState(null);
  }

  async function handleAdd() {
    if (!newAgencyId) { setAddError("Select an agency"); return; }
    setAddSaving(true);
    setAddError(null);

    const res = await fetch("/api/contact_agency_relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        agencyId: newAgencyId,
        relationshipStrength: newStrength,
        associationType: newAssocType,
      }),
    });

    setAddSaving(false);

    if (res.ok) {
      const agency = allAgencies.find((a) => a.id === newAgencyId);
      const newRel: Relationship = {
        agencyId: newAgencyId,
        agencyName: agency?.name ?? newAgencyId,
        relationshipStrength: newStrength,
        associationType: newAssocType,
      };
      setRelationships((prev) => {
        const existing = prev.findIndex((r) => r.agencyId === newAgencyId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newRel;
          return updated;
        }
        return [...prev, newRel];
      });
      setAdding(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setAddError(data.error ?? "Save failed");
    }
  }

  async function handleEdit() {
    if (!editState) return;
    setEditState((s) => s && { ...s, saving: true, error: null });

    const res = await fetch("/api/contact_agency_relationships", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        agencyId: editState.agencyId,
        relationshipStrength: editState.strength,
        associationType: editState.assocType,
      }),
    });

    if (res.ok) {
      setRelationships((prev) =>
        prev.map((r) =>
          r.agencyId === editState.agencyId
            ? { ...r, relationshipStrength: editState.strength, associationType: editState.assocType }
            : r
        )
      );
      setEditState(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setEditState((s) => s && { ...s, saving: false, error: data.error ?? "Save failed" });
    }
  }

  const existingAgencyIds = new Set(relationships.map((r) => r.agencyId));
  const availableAgencies = allAgencies.filter((a) => !existingAgencyIds.has(a.id));

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
        <div className="space-y-2">
          {relationships.map((r) => {
            const isEditing = editState?.agencyId === r.agencyId;

            if (isEditing && editState) {
              return (
                <div key={r.agencyId} className="rounded-lg bg-gray-700/50 border border-gray-600 p-3 space-y-2">
                  <p className="text-gray-300 text-sm font-medium">{r.agencyName}</p>

                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Association</label>
                    <select
                      value={editState.assocType}
                      onChange={(e) => setEditState((s) => s && { ...s, assocType: e.target.value as typeof editState.assocType })}
                      className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                    >
                      <option value="client_of">Client of</option>
                      <option value="ex_client_of">Ex-client of</option>
                      <option value="staff_of">Staff of</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-500 text-xs mb-1 block">Relationship strength</label>
                    <select
                      value={editState.strength}
                      onChange={(e) => setEditState((s) => s && { ...s, strength: e.target.value as typeof editState.strength })}
                      className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                    >
                      <option value="cold">Cold</option>
                      <option value="warm">Warm</option>
                      <option value="strong">Strong</option>
                    </select>
                  </div>

                  {editState.error && <p className="text-red-400 text-xs">{editState.error}</p>}

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={handleEdit}
                      disabled={editState.saving}
                      className="flex items-center gap-1 flex-1 justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      {editState.saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={r.agencyId}
                className="flex items-start justify-between gap-2 group/row"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-gray-300 text-sm truncate">{r.agencyName}</span>
                  <AssocBadge type={r.associationType} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StrengthBadge strength={r.relationshipStrength} />
                  {canEditRelationship(r) && (
                    <button
                      onClick={() => openEdit(r)}
                      className="opacity-0 group-hover/row:opacity-100 text-gray-500 hover:text-gray-300 transition-all p-0.5 rounded"
                      title="Edit relationship"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2.5">
          {isAdmin ? (
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Agency</label>
              <select
                value={newAgencyId}
                onChange={(e) => setNewAgencyId(e.target.value)}
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

          <div>
            <label className="text-gray-500 text-xs mb-1 block">Association</label>
            <select
              value={newAssocType}
              onChange={(e) => setNewAssocType(e.target.value as typeof newAssocType)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="client_of">Client of</option>
              <option value="ex_client_of">Ex-client of</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-gray-500 text-xs mb-1 block">Relationship strength</label>
            <select
              value={newStrength}
              onChange={(e) => setNewStrength(e.target.value as typeof newStrength)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="cold">Cold</option>
              <option value="warm">Warm</option>
              <option value="strong">Strong</option>
            </select>
          </div>

          {addError && <p className="text-red-400 text-xs">{addError}</p>}

          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={handleAdd}
              disabled={addSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
            >
              {addSaving ? "Saving…" : "Save"}
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
