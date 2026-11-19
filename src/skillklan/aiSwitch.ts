import "server-only";
import { NextResponse } from "next/server";
import { isFeatureOff } from "./featureFlags";

// The `ai` switch (Settings → «Функції»): while it is off, nothing may call a
// model. A route answers 403 before it reads anything or resolves a key; a page
// opened before the switch went off keeps its buttons until reloaded, so the
// server refuses too.
const MESSAGE = "AI is switched off by the administrator.";

export async function refuseWhenAiOff(): Promise<NextResponse | null> {
  if (!(await isFeatureOff("ai"))) return null;
  return NextResponse.json({ error: MESSAGE, message: MESSAGE }, { status: 403 });
}
