import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users, agencies } from "@/db/schema";
import { eq } from "drizzle-orm";

const DOMAIN_TO_AGENCY: Record<string, string> = {
  "ogilvy.com": "Ogilvy",
  "groupm.com": "GroupM",
  "grey.com": "Grey",
  "wundermanthompson.com": "Wunderman Thompson",
  "vmlyr.com": "VMLY&R",
  "mindshare.com": "Mindshare",
  "mediacom.com": "MediaCom",
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        if (!email) return null;

        // Get or create the user
        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          // Attempt to auto-assign agency from email domain
          // @wpp.com is the holding-company domain — leave agencyId null and prompt in UI
          const domain = email.split("@")[1];
          let agencyId: string | undefined;

          if (domain && domain !== "wpp.com" && DOMAIN_TO_AGENCY[domain]) {
            const [agency] = await db
              .select()
              .from(agencies)
              .where(eq(agencies.name, DOMAIN_TO_AGENCY[domain]))
              .limit(1);
            if (agency) agencyId = agency.id;
          }

          [user] = await db
            .insert(users)
            .values({ email, agencyId, role: "account_director", isChampion: false })
            .returning();
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async session({ session, token }) {
      if (!session.user?.email) return session;

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, session.user.email))
        .limit(1);

      if (dbUser) {
        session.user.id = dbUser.id;
        (session.user as typeof session.user & {
          role: string;
          agencyId: string | null;
          isChampion: boolean;
        }).role = dbUser.role;
        (session.user as typeof session.user & {
          role: string;
          agencyId: string | null;
          isChampion: boolean;
        }).agencyId = dbUser.agencyId;
        (session.user as typeof session.user & {
          role: string;
          agencyId: string | null;
          isChampion: boolean;
        }).isChampion = dbUser.isChampion;
      }

      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
