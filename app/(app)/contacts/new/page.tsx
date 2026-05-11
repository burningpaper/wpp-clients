import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { agencies, organisations } from "@/db/schema";
import { NewContactForm } from "@/components/new-contact-form";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const user = await requireAuth();

  const [allAgencies, allOrgs] = await Promise.all([
    db.select().from(agencies).orderBy(agencies.name),
    db.select().from(organisations).limit(500),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-semibold">Add contact</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Fill in the required fields. The rest can be added later.
        </p>
      </div>
      <NewContactForm
        agencies={allAgencies}
        organisations={allOrgs}
        currentUserAgencyId={user.agencyId}
        currentUserRole={user.role}
      />
    </div>
  );
}
