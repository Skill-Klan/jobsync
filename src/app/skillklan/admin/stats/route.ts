import { collectUserStats, countUnlinkedAccounts } from "@/skillklan/adminStats";
import { adminData, adminError, refuseUnlessAdminSecret } from "@/skillklan/adminApi";
import { log } from "@/lib/telemetry";

// GET /skillklan/admin/stats — numbers for everyone who came in from the
// cabinet (the SkillKlan admin list and overview). Machine API: the backend's
// secret, never a session (skillklan/adminApi.ts).

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const refused = refuseUnlessAdminSecret(request);
  if (refused) return refused;
  try {
    const [users, unlinkedAccounts] = await Promise.all([collectUserStats(), countUnlinkedAccounts()]);
    return adminData({ users, unlinkedAccounts, generatedAt: new Date().toISOString() });
  } catch (error) {
    log.error("[SkillKlanAdmin] Stats failed", { error: String(error) });
    return adminError(500, "internal");
  }
}
