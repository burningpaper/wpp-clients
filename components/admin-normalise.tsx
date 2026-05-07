"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, CheckCircle2, Loader2 } from "lucide-react";

type Props = {
  unmappedCount: number;
  distinctCompanyCount: number;
};

export function AdminNormalise({ unmappedCount, distinctCompanyCount }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    linked: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    const res = await fetch("/api/admin/normalise", { method: "POST" });
    setRunning(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
    }
  }

  if (unmappedCount === 0) {
    return (
      <div className="flex items-center gap-3 text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl px-5 py-4">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-medium text-sm">All contacts are linked to an organisation</p>
          <p className="text-green-400/70 text-xs mt-0.5">
            Nothing left to normalise. Use the merge tool below to clean up duplicates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white font-medium">
            {unmappedCount.toLocaleString()} contacts have no organisation
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Found{" "}
            <span className="text-white font-medium">
              {distinctCompanyCount.toLocaleString()}
            </span>{" "}
            distinct company name{distinctCompanyCount !== 1 ? "s" : ""} in
            those contacts. Running normalisation will create one organisation
            record per unique name and link every contact automatically.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            After this completes, use the merge tool below to collapse
            duplicates like "Ogilvy SA" and "Ogilvy Africa".
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shrink-0"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
          {running ? "Running…" : "Run normalisation"}
        </button>
      </div>

      {result && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Created{" "}
          <span className="font-semibold">{result.created}</span> organisations
          and linked{" "}
          <span className="font-semibold">{result.linked}</span> contacts.
        </div>
      )}

      {error && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
