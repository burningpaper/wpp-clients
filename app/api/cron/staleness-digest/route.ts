import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, users, organisations } from "@/db/schema";
import { lt, eq, and } from "drizzle-orm";
import { sendMail } from "@/lib/mailer";
import { stalenessDigestEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const staleContacts = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      lastUpdated: contacts.lastUpdated,
      orgName: organisations.name,
    })
    .from(contacts)
    .innerJoin(organisations, eq(contacts.orgId, organisations.id))
    .where(lt(contacts.lastUpdated, ninetyDaysAgo));

  if (staleContacts.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no stale contacts" });
  }

  const champions = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.isChampion, true)));

  if (champions.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no champions" });
  }

  const APP_URL = process.env.NEXTAUTH_URL ?? "https://wpp-clients.vercel.app";

  let sent = 0;
  for (const champion of champions) {
    const html = stalenessDigestEmail({
      recipientName: champion.name ?? champion.email,
      staleContacts: staleContacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        org: c.orgName,
        lastUpdated: c.lastUpdated.toISOString().split("T")[0],
        updateUrl: `${APP_URL}/contacts/${c.id}`,
      })),
    });

    await sendMail({
      to: champion.email,
      subject: `WPP SA Intelligence: ${staleContacts.length} contact${staleContacts.length === 1 ? "" : "s"} need updating`,
      html,
    });

    sent++;
  }

  return NextResponse.json({ sent, staleCount: staleContacts.length });
}
