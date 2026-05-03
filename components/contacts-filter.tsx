"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import type { Agency } from "@/db/schema";

type Props = { agencies: Agency[] };

export function ContactsFilter({ agencies }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`/contacts?${params.toString()}`));
  }

  return (
    <div className="flex items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search contacts, orgs, titles…"
          defaultValue={sp.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Agency filter */}
      <select
        defaultValue={sp.get("agency") ?? ""}
        onChange={(e) => update("agency", e.target.value)}
        className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All agencies</option>
        {agencies.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      {/* Strength filter */}
      <select
        defaultValue={sp.get("strength") ?? ""}
        onChange={(e) => update("strength", e.target.value)}
        className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All strengths</option>
        <option value="strong">Strong</option>
        <option value="warm">Warm</option>
        <option value="cold">Cold</option>
      </select>

      {isPending && (
        <span className="text-gray-500 text-xs">Filtering…</span>
      )}
    </div>
  );
}
