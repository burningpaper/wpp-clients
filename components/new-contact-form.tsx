"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { Agency, Organisation } from "@/db/schema";

type Props = {
  agencies: Agency[];
  organisations: Organisation[];
  currentUserAgencyId: string | null;
  currentUserRole: string;
};

export function NewContactForm({
  agencies,
  organisations,
  currentUserAgencyId,
  currentUserRole,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [showNewOrg, setShowNewOrg] = useState(false);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const orgIdRef = useRef<HTMLSelectElement>(null);

  // Dedup check: fires when first_name + last_name + org_id all have values
  async function checkDuplicate() {
    const fn = firstNameRef.current?.value?.trim();
    const ln = lastNameRef.current?.value?.trim();
    const orgId = orgIdRef.current?.value;
    if (!fn || !ln || !orgId) {
      setDuplicate(null);
      return;
    }
    const res = await fetch(
      `/api/contacts?q=${encodeURIComponent(`${fn} ${ln}`)}`
    );
    const rows = await res.json();
    const match = rows.find(
      (r: { firstName: string; lastName: string; orgId: string }) =>
        r.firstName.toLowerCase() === fn.toLowerCase() &&
        r.lastName.toLowerCase() === ln.toLowerCase() &&
        r.orgId === orgId
    );
    setDuplicate(match ? match.id : null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    let orgId = form.get("orgId") as string;

    // Create new org if needed
    if (orgId === "__new__") {
      const orgRes = await fetch("/api/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName }),
      });
      const org = await orgRes.json();
      orgId = org.id;
    }

    const payload = {
      firstName: form.get("firstName") as string,
      lastName: form.get("lastName") as string,
      orgId,
      title: form.get("title") as string,
      email: form.get("email") as string,
      agencyId: (form.get("agencyId") as string) || currentUserAgencyId || "",
      relationshipStrength: form.get("relationshipStrength") as string,
    };

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to create contact");
      setLoading(false);
      return;
    }

    const contact = await res.json();
    router.push(`/contacts/${contact.id}`);
  }

  const isCeoOrAdmin =
    currentUserRole === "ceo_md" || currentUserRole === "system_admin";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            First name <span className="text-red-400">*</span>
          </label>
          <input
            ref={firstNameRef}
            name="firstName"
            required
            onBlur={checkDuplicate}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Last name <span className="text-red-400">*</span>
          </label>
          <input
            ref={lastNameRef}
            name="lastName"
            required
            onBlur={checkDuplicate}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Organisation */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          Organisation <span className="text-red-400">*</span>
        </label>
        <select
          ref={orgIdRef}
          name="orgId"
          required
          onChange={(e) => {
            setShowNewOrg(e.target.value === "__new__");
            checkDuplicate();
          }}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select organisation…</option>
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="__new__">+ Add new organisation</option>
        </select>

        {showNewOrg && (
          <input
            type="text"
            placeholder="New organisation name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            className="mt-2 w-full bg-gray-800 border border-blue-500 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      {/* Duplicate warning */}
      {duplicate && (
        <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-300 text-sm font-medium">
              Possible duplicate
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              A contact with this name and organisation already exists.{" "}
              <a
                href={`/contacts/${duplicate}`}
                className="underline hover:text-amber-300"
                target="_blank"
                rel="noreferrer"
              >
                View existing record
              </a>{" "}
              before continuing.
            </p>
          </div>
        </div>
      )}

      {/* Title + Email */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Job title
          </label>
          <input
            name="title"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Agency + Strength */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Agency <span className="text-red-400">*</span>
          </label>
          <select
            name="agencyId"
            required
            defaultValue={
              !isCeoOrAdmin && currentUserAgencyId
                ? currentUserAgencyId
                : ""
            }
            disabled={!isCeoOrAdmin && !!currentUserAgencyId}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            {isCeoOrAdmin && <option value="">Select agency…</option>}
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Relationship strength <span className="text-red-400">*</span>
          </label>
          <select
            name="relationshipStrength"
            required
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select…</option>
            <option value="cold">Cold — known by name only</option>
            <option value="warm">Warm — would take your call</option>
            <option value="strong">Strong — active working relationship</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2.5">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? "Saving…" : "Add contact"}
        </button>
        <a
          href="/contacts"
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
