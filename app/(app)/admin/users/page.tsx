import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { users, agencies } from "@/db/schema";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { UserRow } from "@/components/user-row";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  account_director: "Read only",
  ceo_md: "Editor",
  system_admin: "Admin",
};

export default async function AdminUsersPage() {
  const user = await requireAuth();
  if (user.role !== "system_admin") notFound();

  const [allUsers, allAgencies] = await Promise.all([
    db.select().from(users).orderBy(users.name),
    db.select().from(agencies).orderBy(agencies.name),
  ]);

  const roleCounts = {
    account_director: allUsers.filter((u) => u.role === "account_director").length,
    ceo_md: allUsers.filter((u) => u.role === "ceo_md").length,
    system_admin: allUsers.filter((u) => u.role === "system_admin").length,
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
          <ShieldCheck className="w-4.5 h-4.5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-semibold">User management</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {allUsers.length} user{allUsers.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(
          [
            ["account_director", "Read only", "text-gray-400"],
            ["ceo_md", "Editor", "text-blue-400"],
            ["system_admin", "Admin", "text-purple-400"],
          ] as const
        ).map(([key, label, colour]) => (
          <div
            key={key}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3"
          >
            <p className={`text-2xl font-semibold ${colour}`}>
              {roleCounts[key]}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Role legend */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
        <p className="text-gray-300 font-medium text-xs mb-2">Role permissions</p>
        <p className="text-gray-400 text-xs">
          <span className="text-gray-200 font-medium">Read only</span> — can view contacts, organisations, events, and intelligence notes visible to their agency.
        </p>
        <p className="text-gray-400 text-xs">
          <span className="text-gray-200 font-medium">Editor</span> — can edit any contact and view all WPP SA intelligence notes.
        </p>
        <p className="text-gray-400 text-xs">
          <span className="text-gray-200 font-medium">Admin</span> — full access: editor permissions, delete contacts, manage users.
        </p>
      </div>

      {/* Users table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-700/80">
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">
                User
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 w-40">
                Role
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3 w-52">
                Agency
              </th>
              <th className="w-10 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => (
              <UserRow
                key={u.id}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  agencyId: u.agencyId,
                }}
                agencies={allAgencies.map((a) => ({ id: a.id, name: a.name }))}
                currentUserId={user.id}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-gray-600 text-xs mt-3">
        Changes to role and agency save immediately. You cannot change your own role.
      </p>
    </div>
  );
}
