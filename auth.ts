import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Unknown email or no password set yet
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days

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
