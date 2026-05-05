import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { events, eventInvitees, contacts, organisations } from "@/db/schema";
import { eq, ilike, or, and, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Check } from "lucide-react";
import { addInvitee } from "../../actions";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function AddInviteesPage({ params, searchParams }: Params) {
  await requireAuth();
  const { id } = await params;
  const { q = "" } = await searchParams;

  const [event] = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!event) notFound();

  // Contacts already added to this event
  const alreadyAdded = await db
    .select({ contactId: eventInvitees.contactId })
    .from(eventInvitees)
    .where(eq(eventInvitees.eventId, id));
  const alreadyAddedIds = new Set(alreadyAdded.map((r) => r.contactId));

  // Search contacts
  const trimmedQ = q.trim();
  const conditions: ReturnType<typeof or>[] = [isNull(contacts.deletedAt) as any];
  if (trimmedQ.length >= 2) {
    conditions.push(
      or(
        ilike(contacts.firstName, `%${trimmedQ}%`),
        ilike(contacts.lastName, `%${trimmedQ}%`),
        ilike(contacts.title, `%${trimmedQ}%`),
        ilike(contacts.company, `%${trimmedQ}%`),
        ilike(organisations.name, `%${trimmedQ}%`)
      )!
    );
  }

  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      title: contacts.title,
      email: contacts.email,
      company: contacts.company,
      orgName: organisations.name,
    })
    .from(contacts)
    .leftJoin(organisations, eq(contacts.orgId, organisations.id))
    .where(and(...conditions))
    .limit(40);

  // Inline server action — captures `id` (event id) from outer scope
  async function handleAdd(formData: FormData) {
    "use server";
    const contactId = formData.get("contactId") as string;
    await addInvitee(id, contactId);
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/events/${id}`}
        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to {event.name}
      </Link>

      <h1 className="text-white text-2xl font-semibold mb-1">Add invitees</h1>
      <p className="text-gray-400 text-sm mb-5">{event.name}</p>

      {/* Search form — submits on Enter, re-renders server component with q param */}
      <form className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, title, or organisation…"
          autoFocus
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </form>

      {rows.length === 0 ? (
        <p className="text-gray-500 py-8 text-sm text-center">
          {trimmedQ.length >= 2
            ? `No contacts match "${trimmedQ}"`
            : "Type at least 2 characters to search."}
        </p>
      ) : (
        <div className="space-y-1">
          {rows.map((row) => {
            const added = alreadyAddedIds.has(row.id);
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                  <span className="text-gray-300 text-xs font-medium">
                    {row.firstName[0]}
                    {row.lastName[0]}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5 truncate">
                    {row.title ? `${row.title} · ` : ""}
                    {row.orgName ?? row.company ?? ""}
                  </p>
                </div>

                {added ? (
                  <span className="flex items-center gap-1 text-xs text-green-400/80 bg-green-400/10 px-2.5 py-1 rounded-full shrink-0">
                    <Check className="w-3 h-3" />
                    Added
                  </span>
                ) : (
                  <form action={handleAdd}>
                    <input type="hidden" name="contactId" value={row.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-white hover:bg-blue-600 border border-blue-600/50 hover:border-blue-600 px-2.5 py-1 rounded-full transition-all shrink-0"
                    >
                      <UserPlus className="w-3 h-3" />
                      Add
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
