import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "account_director" | "ceo_md" | "system_admin";
  agencyId: string | null;
  isChampion: boolean;
};

/** Get the current user or redirect to /login. */
export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const dbUser = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (dbUser.length === 0) redirect("/login");
  const u = dbUser[0];

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    agencyId: u.agencyId,
    isChampion: u.isChampion,
  };
}

export function canWrite(
  user: SessionUser,
  targetAgencyId: string | null
): boolean {
  if (user.role === "ceo_md" || user.role === "system_admin") return true;
  if (!targetAgencyId) return false;
  return user.agencyId === targetAgencyId;
}

export function canReadNote(
  user: SessionUser,
  visibility: "wpp_sa" | "agency_only",
  createdByAgencyId: string
): boolean {
  if (visibility === "wpp_sa") return true;
  if (user.role === "ceo_md" || user.role === "system_admin") return true;
  return user.agencyId === createdByAgencyId;
}
