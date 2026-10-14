import { redirect } from "next/navigation";
import { auth } from "@/auth";
import db from "@/lib/db";
import { isDevPasswordLoginEnabled } from "@/skillklan/devPasswordLogin";

export default async function RootPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  // No sign-up in SkillKlan Job: a fresh server with no accounts yet still
  // sends people to sign in (from the cabinet). The upstream first-run
  // sign-up stays for local development only.
  if (isDevPasswordLoginEnabled() && (await db.user.count()) === 0) {
    redirect("/signup");
  }
  redirect("/signin");
}
