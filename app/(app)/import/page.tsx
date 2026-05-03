import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ImportForm } from "@/components/import-form";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireAuth();

  if (user.role === "account_director" && !user.isChampion) {
    redirect("/contacts");
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-semibold">Import contacts</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Upload a CSV to bulk-import contacts. All rows are validated before
          anything is written. If any row fails, nothing is imported.
        </p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-5">
        <h2 className="text-white text-sm font-medium mb-2">
          Required CSV format
        </h2>
        <code className="block text-xs text-green-400 bg-gray-900 rounded-lg p-3 font-mono">
          first_name, last_name, organisation, title, email, agency,
          relationship_strength
        </code>
        <p className="text-gray-500 text-xs mt-2">
          <strong className="text-gray-400">relationship_strength</strong> must
          be <code className="text-green-400">cold</code>,{" "}
          <code className="text-green-400">warm</code>, or{" "}
          <code className="text-green-400">strong</code>. Title and email are
          optional. Agency must match a known WPP SA agency name exactly.
        </p>
      </div>

      <ImportForm />
    </div>
  );
}
