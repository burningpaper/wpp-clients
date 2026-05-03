"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { userId: string };

export function AgencySetupPrompt({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const data = new FormData(e.currentTarget);
    await fetch("/api/users/me/agency", {
      method: "POST",
      body: JSON.stringify({ agencyId: data.get("agencyId") }),
      headers: { "Content-Type": "application/json" },
    });
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-md w-full mx-4">
        <h2 className="text-white text-lg font-semibold mb-1">
          Select your agency
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          We couldn&apos;t determine your agency from your email domain. Pick
          the agency you work at to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <AgencySelect />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AgencySelect() {
  const agencies = [
    "Ogilvy",
    "GroupM",
    "Grey",
    "Wunderman Thompson",
    "VMLY&R",
    "Mindshare",
    "MediaCom",
  ];
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">Agency</label>
      <select
        name="agencyId"
        required
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select agency…</option>
        {agencies.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
