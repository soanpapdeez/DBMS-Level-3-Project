
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  logAttempt,
  updateAttemptOutcome,
  getRiskScore,
  getRiskAction,
} from "@/lib/antiScalping";

export async function POST(request: Request) {
  let attemptId: string | null = null;

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      eventId,
      seatIds,
      method,
      simulateFailure,
      deviceFingerprint,
    } = body;

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    if (
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every(
        (seatId: unknown) =>
          Number.isInteger(seatId) && Number(seatId) > 0
      ) ||
      new Set(seatIds).size !== seatIds.length
    ) {
      return NextResponse.json({ error: "Invalid seat IDs" }, { status: 400 });
    }

    if (!["UPI", "CARD", "NETBANKING"].includes(method)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    if (typeof simulateFailure !== "boolean") {
      return NextResponse.json(
        { error: "simulateFailure must be a boolean" },
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

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // MongoDB is required for risk evaluation. Fail closed if unavailable.
    attemptId = await logAttempt({
      userId: String(session.userId),
      eventId: String(eventId),
      ip,
      deviceFingerprint: deviceFingerprint.trim(),
      outcome: "pending",
    });

    const riskScore = await getRiskScore({
      userId: String(session.userId),
      ip,
      deviceFingerprint: deviceFingerprint.trim(),
    });

    const riskAction = getRiskAction(riskScore);

    if (riskAction === "BLOCK") {
      await updateAttemptOutcome(attemptId, "blocked");

      return NextResponse.json(
        {
          error: "Booking blocked due to suspicious activity",
          riskScore,
          action: riskAction,
        },
        { status: 403 }
      );
    }

    if (riskAction === "REVIEW") {
      await pool.query(
        `INSERT INTO booking_reviews
          (user_id, event_id, seat_ids, payment_method,
           simulate_failure, device_fingerprint, ip_address, risk_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          session.userId,
          eventId,
          seatIds,
          method,
          simulateFailure,
          deviceFingerprint.trim(),
          ip,
          riskScore,
        ]
      );

      await updateAttemptOutcome(attemptId, "review");

      return NextResponse.json(
        {
          message: "Booking sent for admin review",
          action: riskAction,
          riskScore,
          bookingPending: true,
        },
        { status: 202 }
      );
    }

    const result = await pool.query(
      `CALL book_tickets(
        $1, $2, $3, $4, $5,
        NULL::integer,
        NULL::numeric,
        NULL::boolean
      )`,
      [
        session.userId,
        eventId,
        seatIds,
        method,
        simulateFailure,
      ]
    );

    const booking = result.rows[0];

    if (!booking.p_payment_succeeded) {
      await updateAttemptOutcome(attemptId, "rejected");

      return NextResponse.json(
        { error: "Payment failed", action: riskAction, riskScore },
        { status: 402 }
      );
    }

    await updateAttemptOutcome(attemptId, "success");

    return NextResponse.json(
      {
        bookingId: booking.p_booking_id,
        total: Number(booking.p_total),
        action: riskAction,
        riskScore,
      },
      { status: 201 }
    );
  } catch (error) {
    // If MongoDB logging or outcome update fails, do not bypass risk checks.
    console.error("Booking API error:", error);

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String(error.code)
        : "";

    if (code === "TK400") {
      return NextResponse.json(
        { error: "Invalid booking request" },
        { status: 400 }
      );
    }

    if (code === "TK403") {
      return NextResponse.json(
        { error: "Booking not permitted" },
        { status: 403 }
      );
    }

    if (code === "TK409") {
      return NextResponse.json(
        { error: "Seats are unavailable or the hold has expired" },
        { status: 409 }
      );
    }

    if (code === "TK421") {
      return NextResponse.json(
        { error: "Booking limit exceeded" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Booking or risk-check service unavailable" },
      { status: 503 }
    );
  }
}
