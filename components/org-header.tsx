"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Edit2, Check, X } from "lucide-react";

type Props = {
  id: string;
  name: string;
  contactCount: number;
  tags: { id: string; name: string }[];
  canEdit: boolean;
};

export function OrgHeader({ id, name, contactCount, tags, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed === name) { setEditing(false); return; }

    setSaving(true);
    setError(null);
    const res = await fetch(`/api/organisations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSaving(false);

    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
    }
  }

  function handleCancel() {
    setValue(name);
    setError(null);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-gray-400" />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div>
              <div className="flex items-center gap-2">
                <input
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setError(null); }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="bg-gray-700 border border-blue-500 text-white text-xl font-semibold rounded-lg px-3 py-1.5 focus:outline-none w-full max-w-md"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !value.trim()}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <h1 className="text-white text-xl font-semibold truncate">{name}</h1>
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-200 border border-gray-700 hover:border-gray-500 text-xs px-2 py-1 rounded-lg transition-colors shrink-0"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>
          )}
          <p className="text-gray-400 text-sm mt-0.5">
            {contactCount} contact{contactCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-700">
          {tags.map((t) => (
            <span
              key={t.id}
              className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
