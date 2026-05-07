"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, KeyRound, X } from "lucide-react";

export type UserRowData = {
  id: string;
  name: string | null;
  email: string;
  role: "account_director" | "ceo_md" | "system_admin";
  agencyId: string | null;
  hasPassword: boolean;
};

export type AgencyOption = {
  id: string;
  name: string;
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
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

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

  async function handleSetPassword() {
    if (newPassword.length < 8) {
      setPwError("Must be at least 8 characters");
      return;
    }
    setPwSaving(true);
    setPwError(null);
    const res = await fetch(`/api/admin/users/${user.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    setPwSaving(false);
    if (res.ok) {
      setPwSaved(true);
      setNewPassword("");
      setTimeout(() => {
        setSettingPassword(false);
        setPwSaved(false);
        startTransition(() => { router.refresh(); });
      }, 1200);
    } else {
      const data = await res.json().catch(() => ({}));
      setPwError(data.error ?? "Save failed");
    }
  }

  return (
    <>
      <tr className="group border-b border-gray-700/40 hover:bg-white/[0.02] transition-colors">
        {/* Identity */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <p className="text-white text-sm font-medium">
                {user.name ?? (
                  <span className="text-gray-500 italic">No name</span>
                )}
                {isSelf && (
                  <span className="ml-2 text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-1.5 py-0.5 rounded-full">
                    You
                  </span>
                )}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">{user.email}</p>
            </div>
          </div>
        </td>

        {/* Role */}
        <td className="px-5 py-3.5 w-36">
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
        <td className="px-5 py-3.5 w-48">
          <select
            defaultValue={user.agencyId ?? ""}
            disabled={isPending}
            onChange={(e) => patch({ agencyId: e.target.value || null })}
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

        {/* Password + status */}
        <td className="px-5 py-3.5 w-36 text-right">
          <div className="flex items-center justify-end gap-2">
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : null}
            <button
              onClick={() => {
                setSettingPassword((v) => !v);
                setPwError(null);
                setNewPassword("");
              }}
              title={user.hasPassword ? "Change password" : "Set password"}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                user.hasPassword
                  ? "text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-600"
                  : "text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-400/50 bg-amber-400/5"
              }`}
            >
              <KeyRound className="w-3 h-3" />
              {user.hasPassword ? "Change" : "Set password"}
            </button>
          </div>
        </td>
      </tr>

      {/* Inline password form */}
      {settingPassword && (
        <tr className="border-b border-gray-700/40 bg-gray-800/60">
          <td colSpan={4} className="px-5 py-3">
            <div className="flex items-center gap-3">
              <KeyRound className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <span className="text-gray-400 text-xs shrink-0 w-32">
                {user.name ?? user.email}
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPwError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
                placeholder="New password (min. 8 chars)"
                autoFocus
                className="bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-500"
              />
              {pwError && (
                <span className="text-red-400 text-xs">{pwError}</span>
              )}
              {pwSaved && (
                <span className="text-green-400 text-xs flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
              <button
                onClick={handleSetPassword}
                disabled={pwSaving || pwSaved}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {pwSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setSettingPassword(false);
                  setPwError(null);
                  setNewPassword("");
                }}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
