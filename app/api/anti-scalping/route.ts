
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  logAttempt,
  getRiskScore,
  getRiskAction,
} from "@/lib/antiScalping";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user.
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const { eventId, deviceFingerprint } = body;

    if (
      (typeof eventId !== "string" &&
        !Number.isInteger(eventId)) ||
      !String(eventId).trim() ||
      typeof deviceFingerprint !== "string" ||
      !deviceFingerprint.trim()
    ) {
      return NextResponse.json(
        { error: "Invalid event ID or device fingerprint" },
        { status: 400 }
      );
    }

    // Derive IP from request headers, not the body.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const userId = String(session.userId);

    await logAttempt({
      userId,
      eventId: String(eventId),
      ip,
      deviceFingerprint: deviceFingerprint.trim(),
      outcome: "pending",
    });

    const riskScore = await getRiskScore({
      userId,
      ip,
      deviceFingerprint: deviceFingerprint.trim(),
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
              ? "Purchase requires admin review."
              : "Purchase attempt recorded.",
      },
      { status: action === "BLOCK" ? 403 : 200 }
    );
  } catch (error) {
    console.error("Anti-scalping API error:", error);

    return NextResponse.json(
      { error: "Anti-scalping service unavailable" },
      { status: 503 }
    );
  }
}
