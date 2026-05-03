import { requireAuth } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { db } from "@/db";
import { agencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AgencySetupPrompt } from "@/components/agency-setup-prompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  let agencyName: string | null = null;
  if (user.agencyId) {
    const agency = await db
      .select()
      .from(agencies)
      .where(eq(agencies.id, user.agencyId))
      .limit(1);
    agencyName = agency[0]?.name ?? null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Nav
        userName={user.name}
        agencyName={agencyName}
        role={user.role}
      />
      <main className="pl-56">
        {/* Agency setup prompt for users who logged in via @wpp.com with no agency */}
        {!user.agencyId && <AgencySetupPrompt userId={user.id} />}
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
