"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Edit2,
  X,
  Check,
  Briefcase,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  MapPin,
  Clock,
} from "lucide-react";
import type { Contact } from "@/db/schema";

const CATEGORY_OPTIONS = [
  { value: "client_sa", label: "Client (SA)" },
  { value: "client_africa", label: "Client (Africa)" },
  { value: "client_global", label: "Client (Global)" },
  { value: "industry_sa", label: "Industry (SA)" },
  { value: "industry_africa", label: "Industry (Africa)" },
  { value: "industry_global", label: "Industry (Global)" },
  { value: "agency_sa", label: "Agency (SA)" },
  { value: "agency_africa", label: "Agency (Africa)" },
  { value: "agency_global", label: "Agency (Global)" },
  { value: "rising_star", label: "Rising Star" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
];

const GENDER_LABELS: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS.map((o) => [o.value, o.label])
);

const RACE_OPTIONS = [
  { value: "african", label: "African" },
  { value: "coloured", label: "Coloured" },
  { value: "indian", label: "Indian" },
  { value: "white", label: "White" },
  { value: "other", label: "Other" },
];

const RACE_LABELS: Record<string, string> = Object.fromEntries(
  RACE_OPTIONS.map((o) => [o.value, o.label])
);

type Tag = { id: string; name: string };

type Props = {
  contact: Contact;
  org: { id: string; name: string } | null;
  tags: Tag[];
  canEdit: boolean;
};

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function emptyForm(c: Contact) {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title ?? "",
    email: c.email ?? "",
    company: c.company ?? "",
    category: c.category ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    gender: c.gender ?? "",
    race: c.race ?? "",
    assistantEmail: c.assistantEmail ?? "",
    mobileNumber: c.mobileNumber ?? "",
    linkedinUrl: c.linkedinUrl ?? "",
  };
}

export function ContactHeader({ contact, org, tags, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(contact));

  function field(key: keyof typeof form) {
    return (val: string) => setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        title: form.title || null,
        email: form.email || null,
        company: form.company || null,
        category: form.category || null,
        city: form.city || null,
        country: form.country || null,
        gender: form.gender || null,
        race: form.race || null,
        assistantEmail: form.assistantEmail || null,
        mobileNumber: form.mobileNumber || null,
        linkedinUrl: form.linkedinUrl || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed. Please try again.");
    }
  }

  function handleCancel() {
    setForm(emptyForm(contact));
    setEditing(false);
    setError(null);
  }

  // ── Edit mode ────────────────────────────────────────────────────────────

  if (editing) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">
            Edit contact
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Name & Role */}
          <div>
            <SectionHeading>Name &amp; Role</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="First name"
                value={form.firstName}
                onChange={field("firstName")}
              />
              <TextInput
                label="Last name"
                value={form.lastName}
                onChange={field("lastName")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <TextInput
                label="Job title"
                value={form.title}
                onChange={field("title")}
                placeholder="e.g. Chief Marketing Officer"
              />
              <TextInput
                label="Company"
                value={form.company}
                onChange={field("company")}
                placeholder="e.g. Vodacom"
              />
            </div>
          </div>

          {/* Contact info */}
          <div>
            <SectionHeading>Contact</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Email"
                type="email"
                value={form.email}
                onChange={field("email")}
              />
              <TextInput
                label="Mobile"
                value={form.mobileNumber}
                onChange={field("mobileNumber")}
                placeholder="+27 82 000 0000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <TextInput
                label="Assistant email"
                type="email"
                value={form.assistantEmail}
                onChange={field("assistantEmail")}
              />
              <TextInput
                label="LinkedIn URL"
                value={form.linkedinUrl}
                onChange={field("linkedinUrl")}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <SectionHeading>Location</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="City"
                value={form.city}
                onChange={field("city")}
                placeholder="e.g. Johannesburg"
              />
              <TextInput
                label="Country"
                value={form.country}
                onChange={field("country")}
                placeholder="e.g. South Africa"
              />
            </div>
          </div>

          {/* Classification */}
          <div>
            <SectionHeading>Classification</SectionHeading>
            <div className="grid grid-cols-3 gap-3">
              <SelectInput
                label="Category"
                value={form.category}
                onChange={field("category")}
                options={CATEGORY_OPTIONS}
              />
              <SelectInput
                label="Gender"
                value={form.gender}
                onChange={field("gender")}
                options={GENDER_OPTIONS}
              />
              <SelectInput
                label="Race"
                value={form.race}
                onChange={field("race")}
                options={RACE_OPTIONS}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm mt-4">{error}</p>
        )}

        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving || !form.firstName || !form.lastName}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── View mode ────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gray-700 flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-semibold">
            {contact.firstName[0]}
            {contact.lastName[0]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-white text-xl font-semibold">
                {contact.firstName} {contact.lastName}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {contact.title && (
                  <span className="flex items-center gap-1 text-gray-400 text-sm">
                    <Briefcase className="w-3.5 h-3.5" />
                    {contact.title}
                  </span>
                )}
                {org ? (
                  <Link
                    href={`/organisations/${org.id}`}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {org.name}
                  </Link>
                ) : contact.company ? (
                  <span className="flex items-center gap-1 text-gray-400 text-sm">
                    <Building2 className="w-3.5 h-3.5" />
                    {contact.company}
                  </span>
                ) : null}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1 text-gray-400 hover:text-gray-300 text-sm transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {contact.email}
                  </a>
                )}
              </div>
            </div>

            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-200 text-xs border border-gray-700 hover:border-gray-500 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2 text-gray-500 text-xs">
            <Clock className="w-3 h-3" />
            Last updated{" "}
            {contact.lastUpdated.toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Secondary details */}
      {(contact.mobileNumber ||
        contact.city ||
        contact.country ||
        contact.category ||
        contact.gender ||
        contact.race ||
        contact.linkedinUrl ||
        contact.assistantEmail) && (
        <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-x-6 gap-y-2">
          {contact.mobileNumber && (
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <Phone className="w-3.5 h-3.5 shrink-0 text-gray-500" />
              {contact.mobileNumber}
            </div>
          )}
          {contact.linkedinUrl && (
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              LinkedIn profile
            </a>
          )}
          {(contact.city || contact.country) && (
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-500" />
              {[contact.city, contact.country].filter(Boolean).join(", ")}
            </div>
          )}
          {contact.assistantEmail && (
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <Mail className="w-3.5 h-3.5 shrink-0 text-gray-500" />
              <span className="text-gray-500 mr-1">Asst:</span>
              {contact.assistantEmail}
            </div>
          )}
          {contact.category && (
            <div className="text-sm">
              <span className="text-gray-500">Category: </span>
              <span className="text-gray-300">
                {CATEGORY_LABELS[contact.category] ?? contact.category}
              </span>
            </div>
          )}
          {(contact.gender || contact.race) && (
            <div className="text-sm text-gray-400">
              {[
                contact.gender ? GENDER_LABELS[contact.gender] : null,
                contact.race ? RACE_LABELS[contact.race] : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
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
