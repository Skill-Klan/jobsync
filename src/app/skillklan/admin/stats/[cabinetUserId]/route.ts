import { collectUserStats } from "@/skillklan/adminStats";
import { adminData, adminError, parseCabinetUserId, refuseUnlessAdminSecret } from "@/skillklan/adminApi";
import { log } from "@/lib/telemetry";

// GET /skillklan/admin/stats/:cabinetUserId — one person's numbers (the
// admin's person page). Someone who never came in is `user: null`, not 404 —
// the same answer whether the id is unknown here or unknown everywhere.

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cabinetUserId: string }> },
): Promise<Response> {
  const refused = refuseUnlessAdminSecret(request);
  if (refused) return refused;
  const id = parseCabinetUserId((await params).cabinetUserId);
  if (id === null) return adminError(400, "bad_request");
  try {
    const [user] = await collectUserStats([id]);
    return adminData({ user: user ?? null, generatedAt: new Date().toISOString() });
  } catch (error) {
    log.error("[SkillKlanAdmin] Person stats failed", { error: String(error) });
    return adminError(500, "internal");
  }
}
