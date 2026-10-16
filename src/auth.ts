import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { User } from "./models/user.model";
import prisma from "./lib/db";
import { exchangeLoginCode } from "./skillklan/cabinetApi";
import { findOrCreateCabinetUser } from "./skillklan/cabinetUser";
import { isDevPasswordLoginEnabled } from "./skillklan/devPasswordLogin";

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    return user || undefined;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw new Error("Failed to fetch user.");
  }
}

// SkillKlan cabinet login: the cabinet posts a one-time code to
// /auth/cabinet, which signs in with this provider. The backend trades the
// code for the person; we find or create their account. Fail closed — no
// answer, no session (src/skillklan/cabinetApi.ts).
const cabinetProvider = Credentials({
  id: "cabinet",
  name: "SkillKlan cabinet",
  credentials: { code: {} },
  async authorize(credentials) {
    const code = typeof credentials?.code === "string" ? credentials.code : "";
    const identity = await exchangeLoginCode(code);
    if (!identity) return null;
    const user = await findOrCreateCabinetUser(identity);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      cabinetUserId: identity.userId,
      cabinetRole: identity.role,
    };
  },
});

// Upstream email + password login — local development and the Playwright
// suite only (src/skillklan/devPasswordLogin.ts).
const passwordProvider = Credentials({
  async authorize(credentials) {
    const parsedCredentials = z
      .object({ email: z.string().email(), password: z.string().min(6) })
      .safeParse(credentials);

    if (parsedCredentials.success) {
      const { email, password } = parsedCredentials.data;
      const user = await getUser(email);
      if (!user) return null;
      const passwordsMatch = await bcrypt.compare(password, user.password);
      if (passwordsMatch) return user;
    }
    console.log("Invalid credentials");
    return null;
  },
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: isDevPasswordLoginEnabled()
    ? [cabinetProvider, passwordProvider]
    : [cabinetProvider],
});
