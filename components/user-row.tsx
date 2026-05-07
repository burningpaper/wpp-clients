"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

export type UserRowData = {
  id: string;
  name: string | null;
  email: string;
  role: "account_director" | "ceo_md" | "system_admin";
  agencyId: string | null;
};

export type AgencyOption = {
  id: string;
  name: string;
};

const ROLE_LABELS: Record<string, string> = {
  account_director: "Read only",
  ceo_md: "Editor",
  system_admin: "Admin",
};

type Props = {
  user: UserRowData;
  agencies: AgencyOption[];
  currentUserId: string;
};

export function UserRow({ user, agencies, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const isSelf = user.id === currentUserId;

  async function patch(changes: { role?: string; agencyId?: string | null }) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      startTransition(() => { router.refresh(); });
    }
  }

  return (
    <tr className="group border-b border-gray-700/40 hover:bg-white/[0.02] transition-colors">
      {/* Identity */}
      <td className="px-5 py-3.5">
        <p className="text-white text-sm font-medium">
          {user.name ?? <span className="text-gray-500 italic">No name</span>}
          {isSelf && (
            <span className="ml-2 text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-1.5 py-0.5 rounded-full">
              You
            </span>
          )}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">{user.email}</p>
      </td>

      {/* Role */}
      <td className="px-5 py-3.5 w-40">
        <select
          defaultValue={user.role}
          disabled={isSelf || isPending}
          onChange={(e) => patch({ role: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="account_director">Read only</option>
          <option value="ceo_md">Editor</option>
          <option value="system_admin">Admin</option>
        </select>
      </td>

      {/* Agency */}
      <td className="px-5 py-3.5 w-52">
        <select
          defaultValue={user.agencyId ?? ""}
          disabled={isPending}
          onChange={(e) =>
            patch({ agencyId: e.target.value || null })
          }
          className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        >
          <option value="">No agency</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </td>

      {/* Status indicator */}
      <td className="px-5 py-3.5 w-10 text-right">
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin ml-auto" />
        ) : saved ? (
          <Check className="w-3.5 h-3.5 text-green-400 ml-auto" />
        ) : null}
      </td>
    </tr>
  );
}
