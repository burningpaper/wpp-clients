"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function OrgSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <input
      type="text"
      placeholder="Search organisations…"
      defaultValue={defaultValue}
      onChange={(e) => {
        const params = new URLSearchParams(sp.toString());
        if (e.target.value) params.set("q", e.target.value);
        else params.delete("q");
        startTransition(() =>
          router.push(`/organisations?${params.toString()}`)
        );
      }}
      className="bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
    />
  );
}
