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

    const apiKey = await resolveApiKey(userId, "gemini");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Gemini models" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    log.error("Error fetching models", {
      provider: "gemini",
      error: String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch Gemini models" },
      { status: 500 }
    );
  }
}
