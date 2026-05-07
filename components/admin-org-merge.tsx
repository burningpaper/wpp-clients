"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  GitMerge,
  X,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react";

export type OrgRow = {
  id: string;
  name: string;
  contactCount: number;
};

type MergeState = {
  sourceId: string;
  sourceName: string;
  sourceCount: number;
};

export function AdminOrgMerge({ orgs }: { orgs: OrgRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [merge, setMerge] = useState<MergeState | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [merging, setMerging] = useState(false);
  const [lastMerge, setLastMerge] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return orgs;
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, query]);

  const targetOptions = useMemo(() => {
    if (!merge) return [];
    const q = targetSearch.toLowerCase().trim();
    return orgs.filter(
      (o) =>
        o.id !== merge.sourceId &&
        (q === "" || o.name.toLowerCase().includes(q))
    );
  }, [orgs, merge, targetSearch]);

  async function handleMerge(targetId: string, targetName: string) {
    if (!merge) return;
    setMerging(true);
    const res = await fetch(
      `/api/admin/organisations/${merge.sourceId}/merge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      }
    );
    setMerging(false);
    if (res.ok) {
      setLastMerge(
        `"${merge.sourceName}" merged into "${targetName}" — ${merge.sourceCount} contact${merge.sourceCount !== 1 ? "s" : ""} moved`
      );
      setMerge(null);
      setTargetSearch("");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search organisations…"
          className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {lastMerge && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2.5 mb-4">
          <Check className="w-4 h-4 shrink-0" />
          {lastMerge}
        </div>
      )}

      {/* Merge panel */}
      {merge && (
        <div className="bg-gray-800 border border-blue-500/40 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white text-sm font-medium">
              <GitMerge className="w-4 h-4 text-blue-400" />
              Merge{" "}
              <span className="text-blue-400">"{merge.sourceName}"</span>
              {" "}into…
            </div>
            <button
              onClick={() => {
                setMerge(null);
                setTargetSearch("");
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-gray-500 text-xs mb-3">
            {merge.sourceCount} contact{merge.sourceCount !== 1 ? "s" : ""} will be moved to the target organisation, then "{merge.sourceName}" will be deleted.
          </p>
          <input
            value={targetSearch}
            onChange={(e) => setTargetSearch(e.target.value)}
            placeholder="Search for target organisation…"
            autoFocus
            className="w-full bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {targetOptions.slice(0, 50).map((org) => (
              <button
                key={org.id}
                onClick={() => handleMerge(org.id, org.name)}
                disabled={merging || isPending}
                className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <span className="text-white text-sm">{org.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">
                    {org.contactCount} contact{org.contactCount !== 1 ? "s" : ""}
                  </span>
                  {merging ? (
                    <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
              </button>
            ))}
            {targetOptions.length === 0 && (
              <p className="text-gray-500 text-sm px-3 py-2">No organisations match</p>
            )}
          </div>
        </div>
      )}

      {/* Org table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-700/80">
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">
                Organisation
                {query && (
                  <span className="text-gray-600 font-normal ml-2">
                    {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                  </span>
                )}
              </th>
              <th className="text-right text-xs font-medium text-gray-500 px-5 py-3 w-28">
                Contacts
              </th>
              <th className="w-28 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/40">
            {filtered.map((org) => (
              <tr
                key={org.id}
                className={`group hover:bg-white/[0.02] transition-colors ${
                  merge?.sourceId === org.id ? "bg-blue-600/5" : ""
                }`}
              >
                <td className="px-5 py-3 min-w-0">
                  <Link
                    href={`/organisations/${org.id}`}
                    className="text-white text-sm hover:text-blue-400 transition-colors"
                  >
                    {org.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-gray-400 text-sm">
                    {org.contactCount}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() =>
                      setMerge({
                        sourceId: org.id,
                        sourceName: org.name,
                        sourceCount: org.contactCount,
                      })
                    }
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 px-2 py-1 rounded transition-all ml-auto"
                  >
                    <GitMerge className="w-3 h-3" />
                    Merge
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-gray-500 text-sm">
                  No organisations match "{query}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
