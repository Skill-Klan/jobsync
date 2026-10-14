import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Node.js runtime: the session's access re-check (auth.config) calls the
  // SkillKlan backend with a secret read from the server's environment at run
  // time — not something to leave to the edge sandbox.
  runtime: "nodejs",
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/api/((?!auth).*)",
  ],
};
