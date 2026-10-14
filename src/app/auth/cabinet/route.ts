import { AuthError } from "next-auth";
import { signIn } from "@/auth";

// Where the SkillKlan cabinet sends people: a POST form carrying a one-time
// code (in the body, never in the URL — query strings end up in proxy logs).
// The code is traded at the backend by the "cabinet" provider (auth.ts).
//
// Only the cabinet may post here. Without the Origin check any site could
// submit a code it got for its own cabinet account and quietly sign a visitor
// into that account (login CSRF) — the cabinet and SkillKlan Job are the same
// site to the browser, so SameSite cookies do not stop it.
//
// Every failure lands on the sign-in page with one generic message: whether
// the code was used, expired or forged is not something to tell the caller.

export const dynamic = "force-dynamic";

const FAILED = "/signin?error=cabinet";

function cabinetOrigin(): string | null {
  const url = process.env.CABINET_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function seeOther(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const expected = cabinetOrigin();
  if (!expected || request.headers.get("origin") !== expected) {
    return seeOther(FAILED);
  }

  let code = "";
  try {
    const value = (await request.formData()).get("code");
    code = typeof value === "string" ? value : "";
  } catch {
    code = "";
  }
  if (!code) return seeOther(FAILED);

  try {
    await signIn("cabinet", { code, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return seeOther(FAILED);
    throw error;
  }
  return seeOther("/dashboard");
}
