import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/api-key-resolver";
import { log } from "@/lib/telemetry";
import { refuseWhenAiOff } from "@/skillklan/aiSwitch";

export async function GET() {
  const aiOff = await refuseWhenAiOff();
  if (aiOff) return aiOff;
  try {
    const session = await auth();
    const userId = session?.user?.id;

    const apiKey = await resolveApiKey(userId, "openrouter");

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured. Add your key in API Keys settings." },
        { status: 401 }
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch OpenRouter models" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    log.error("Error fetching models", {
      provider: "openrouter",
      error: String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch OpenRouter models" },
      { status: 500 }
    );
  }
}
