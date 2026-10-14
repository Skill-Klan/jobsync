import type { NextAuthConfig } from "next-auth";
import { checkCabinetAccess } from "@/skillklan/cabinetApi";
import { isDevPasswordLoginEnabled } from "@/skillklan/devPasswordLogin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  }
  interface User {
    cabinetUserId?: number | null;
  }
}

// SkillKlan rules §3.4: an excluded student loses access within 5 minutes.
// The session asks the backend at least this often and ends on "no", on an
// error and on a timeout alike (fail closed). Runs in middleware, so the
// refreshed token is written back to the cookie and the backend is asked
// once per window, not on every request.
export const ACCESS_RECHECK_MS = 5 * 60 * 1000;
// A working day; the upstream default (30 days) is far too long for a
// session whose owner can be excluded.
export const SESSION_MAX_AGE_S = 8 * 60 * 60;

export const authConfig = {
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isApiRoute = nextUrl.pathname.startsWith("/api");

      if (isOnDashboard || isApiRoute) {
        return isLoggedIn;
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.cabinetUserId = user.cabinetUserId ?? null;
        token.accessCheckedAt = Date.now();
        return token;
      }

      const cabinetUserId = token.cabinetUserId as number | null | undefined;
      if (cabinetUserId) {
        const checkedAt = (token.accessCheckedAt as number | undefined) ?? 0;
        if (Date.now() - checkedAt < ACCESS_RECHECK_MS) return token;
        if (!(await checkCabinetAccess(cabinetUserId))) return null;
        token.accessCheckedAt = Date.now();
        return token;
      }

      // No cabinet person behind the session: only the dev-only password
      // login makes those. Anywhere else such a token is not a way in.
      return isDevPasswordLoginEnabled() ? token : null;
    },
    async session({ session, token }) {
      const userId = (token.id as string) || token.sub;
      if (userId) {
        session.user.id = userId;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
