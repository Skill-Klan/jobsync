import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";
import { automationLogger } from "@/lib/automation-logger";
import { isFeatureOff } from "@/skillklan/featureFlags";
import { getTranslations } from "@/i18n/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!session || !userId) {
    return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
  }

  // Automations switched off (Settings → «Функції»): refuse, as /run does.
  if (await isFeatureOff("automations")) {
    const t = await getTranslations("automations");
    return NextResponse.json({ message: t("errors.switchedOff") }, { status: 403 });
  }

  const { id: automationId } = await params;

  const automation = await db.automation.findFirst({
    where: {
      id: automationId,
      userId,
    },
  });

  if (!automation) {
    return NextResponse.json({ message: "Automation not found" }, { status: 404 });
  }

  automationLogger.clearLogs(automationId);

  return NextResponse.json({ success: true });
}
