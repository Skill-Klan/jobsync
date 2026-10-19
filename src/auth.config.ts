import type { NextAuthConfig } from "next-auth";
import { recheckCabinetAccess } from "@/skillklan/accessRecheck";
import { isDevPasswordLoginEnabled } from "@/skillklan/devPasswordLogin";
import { managesSkillklanJob, type CabinetRole } from "@/skillklan/cabinetApi";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      // A SkillKlan admin, by the backend's last answer (≤ 5 minutes old).
      // Enough to show admin-only settings; a change asks the backend again.
      isAdmin?: boolean;
    };
  }
  interface User {
    cabinetUserId?: number | null;
    cabinetRole?: CabinetRole | null;
  }
}

// SkillKlan rules §3.4: an excluded student loses access within 5 minutes.
// The session asks the backend at least this often and ends on "no", on an
// error and on a timeout alike (fail closed). The refreshed token goes back
// into the cookie, so later requests are quiet; the many auth() calls of the
// one request that reads the stale cookie share one answer
// (skillklan/accessRecheck.ts).
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
        token.cabinetRole = user.cabinetRole ?? null;
        token.accessCheckedAt = Date.now();
        return token;
      }

      const cabinetUserId = token.cabinetUserId as number | null | undefined;
      if (cabinetUserId) {
        const checkedAt = (token.accessCheckedAt as number | undefined) ?? 0;
        if (Date.now() - checkedAt < ACCESS_RECHECK_MS) return token;
        const recheck = await recheckCabinetAccess(cabinetUserId);
        if (!recheck.allowed) return null;
        // The role follows the backend: a demoted admin is a student here
        // within the same 5 minutes.
        token.cabinetRole = recheck.role;
        token.accessCheckedAt = recheck.checkedAt;
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
      // "Admin" here means manages SkillKlan Job: the admin or the QA moderator (D81).
      session.user.isAdmin = managesSkillklanJob(token.cabinetRole as CabinetRole | null | undefined);
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
