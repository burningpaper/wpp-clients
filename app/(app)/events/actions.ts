"use server";

import { db } from "@/db";
import { events, eventInvitees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createEvent(formData: FormData) {
  await requireAuth();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Event name is required");

  const description = (formData.get("description") as string)?.trim() || null;
  const venue = (formData.get("venue") as string)?.trim() || null;
  const eventDate = (formData.get("event_date") as string) || null;
  const capacityRaw = formData.get("capacity") as string;
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null;

  const [event] = await db
    .insert(events)
    .values({ name, description, venue, eventDate, capacity })
    .returning({ id: events.id });

  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

export async function addInvitee(eventId: string, contactId: string) {
  await requireAuth();

  try {
    await db.insert(eventInvitees).values({ eventId, contactId });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "23505"
    ) {
      return { error: "Contact already added to this event" };
    }
    throw e;
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/add-invitees`);
}

export async function updateInviteeStatus(
  inviteeId: string,
  eventId: string,
  field: "invite_status" | "rsvp_status",
  value: string
) {
  await requireAuth();

  if (field === "invite_status") {
    await db
      .update(eventInvitees)
      .set({
        inviteStatus: value as
          | "first_round_invite"
          | "second_round_invite"
          | "third_round_invite"
          | "agency_invite"
          | "rising_star_invite"
          | "waiting_list"
          | "other_invite"
          | "no",
      })
      .where(eq(eventInvitees.id, inviteeId));
  } else {
    await db
      .update(eventInvitees)
      .set({
        rsvpStatus: value as
          | "pending"
          | "bounced"
          | "error"
          | "accepted"
          | "declined"
          | "cancelled"
          | "no_show"
          | "accepted_on_their_behalf",
      })
      .where(eq(eventInvitees.id, inviteeId));
  }

  revalidatePath(`/events/${eventId}`);
}

export async function removeInvitee(inviteeId: string, eventId: string) {
  await requireAuth();
  await db.delete(eventInvitees).where(eq(eventInvitees.id, inviteeId));
  revalidatePath(`/events/${eventId}`);
}
