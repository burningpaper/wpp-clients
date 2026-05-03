"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

type Props = {
  contactId?: string;
  orgId?: string;
  agencyId: string;
};

export function AddNoteForm({ contactId, orgId, agencyId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    await fetch("/api/intelligence_notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: contactId ?? null,
        orgId: orgId ?? null,
        noteType: form.get("noteType"),
        body: form.get("body"),
        visibility: form.get("visibility"),
      }),
    });

    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-400 transition-colors py-2"
      >
        <Plus className="w-4 h-4" />
        Add intelligence note
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800 border border-blue-500/50 rounded-xl p-4 space-y-3 mt-2"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <select
            name="noteType"
            required
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="meeting">Meeting</option>
            <option value="news">News</option>
            <option value="budget_signal">Budget signal</option>
            <option value="relationship">Relationship</option>
            <option value="risk">Risk</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Visibility</label>
          <select
            name="visibility"
            defaultValue="wpp_sa"
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="wpp_sa">All WPP SA</option>
            <option value="agency_only">Agency only</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Note</label>
        <textarea
          name="body"
          required
          rows={4}
          placeholder="What intelligence do you have? Be specific — names, budget signals, decisions, relationships…"
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? "Saving…" : "Add note"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
