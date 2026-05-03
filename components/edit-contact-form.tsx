"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Agency, Contact } from "@/db/schema";

type Relationship = {
  agencyId: string;
  agencyName: string;
  relationshipStrength: "cold" | "warm" | "strong";
  lastContactDate: Date | null;
  relationshipOwnerId: string | null;
};

type Props = {
  contact: Contact;
  agencies: Agency[];
  relationships: Relationship[];
  currentUserAgencyId: string | null;
  currentUserRole: string;
};

export function EditContactForm({
  contact,
  agencies,
  relationships,
  currentUserAgencyId,
  currentUserRole,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isCeoOrAdmin =
    currentUserRole === "ceo_md" || currentUserRole === "system_admin";

  const editableAgencyId =
    isCeoOrAdmin
      ? (relationships[0]?.agencyId ?? currentUserAgencyId)
      : (currentUserAgencyId ?? relationships[0]?.agencyId);

  const myRelationship = relationships.find(
    (r) => r.agencyId === editableAgencyId
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    // Update contact fields
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        title: form.get("title"),
        email: form.get("email"),
        agencyId: editableAgencyId,
      }),
    });

    // Update relationship strength
    if (editableAgencyId) {
      await fetch("/api/contact_agency_relationships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          agencyId: editableAgencyId,
          relationshipStrength: form.get("relationshipStrength"),
        }),
      });
    }

    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">First name</label>
          <input
            name="firstName"
            defaultValue={contact.firstName}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Last name</label>
          <input
            name="lastName"
            defaultValue={contact.lastName}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Job title</label>
        <input
          name="title"
          defaultValue={contact.title ?? ""}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Email</label>
        <input
          name="email"
          type="email"
          defaultValue={contact.email ?? ""}
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {myRelationship && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Relationship strength
          </label>
          <select
            name="relationshipStrength"
            defaultValue={myRelationship.relationshipStrength}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="cold">Cold</option>
            <option value="warm">Warm</option>
            <option value="strong">Strong</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {loading ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}
