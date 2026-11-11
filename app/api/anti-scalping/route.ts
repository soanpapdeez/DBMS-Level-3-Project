
import { NextRequest, NextResponse } from "next/server";
import {
  logAttempt,
  getRiskScore,
  getRiskAction,
} from "@/lib/antiScalping";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, eventId, ip, deviceFingerprint, outcome } = body;

    if (
      !userId ||
      !eventId ||
      !ip ||
      !deviceFingerprint ||
      !outcome
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await logAttempt({
      userId: String(userId),
      eventId: String(eventId),
      ip: String(ip),
      deviceFingerprint: String(deviceFingerprint),
      outcome: String(outcome),
    });

    const riskScore = await getRiskScore({
      userId: String(userId),
      ip: String(ip),
      deviceFingerprint: String(deviceFingerprint),
    });

    const action = getRiskAction(riskScore);

    return NextResponse.json(
      {
        success: true,
        riskScore,
        action,
        message:
          action === "BLOCK"
            ? "Suspicious activity detected. Purchase blocked."
            : action === "REVIEW"
              ? "Purchase allowed but flagged for review."
              : "Purchase attempt recorded.",
      },
      { status: action === "BLOCK" ? 403 : 200 }
    );
  } catch (error) {
    console.error("Anti-scalping API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
