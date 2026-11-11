import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const eventId = Number(id);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const { seatIds, deviceFingerprint } = body;

    if (
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every(
        (seatId: unknown) =>
          Number.isInteger(seatId) && Number(seatId) > 0
      )
    ) {
      return NextResponse.json(
        { error: "A non-empty array of valid seat IDs is required" },
        { status: 400 }
      );
    }

    if (
      typeof deviceFingerprint !== "string" ||
      !deviceFingerprint.trim()
    ) {
      return NextResponse.json(
        { error: "Device fingerprint is required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      "SELECT hold_seats($1, $2, $3) AS expires_at",
      [session.userId, eventId, seatIds]
    );

    return NextResponse.json({
      expiresAt: result.rows[0].expires_at,
    });
   } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";

    if (code === "TK400") {
      return NextResponse.json(
        { error: "Invalid seat hold request" },
        { status: 400 }
      );
    }

    if (code === "TK403") {
      return NextResponse.json(
        { error: "Seat hold is not permitted" },
        { status: 403 }
      );
    }

    if (code === "TK409") {
      return NextResponse.json(
        { error: "One or more seats are unavailable" },
        { status: 409 }
      );
    }

    console.error("POST /api/events/[id]/hold error:", error);

    return NextResponse.json(
      { error: "Failed to hold seats" },
      { status: 500 }
    );
  }
}