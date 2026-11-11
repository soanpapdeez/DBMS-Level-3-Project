
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    // Require an authenticated user.
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Read and validate the request body.
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
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      !seatIds.every(
        (seatId: unknown) =>
          Number.isInteger(seatId) && Number(seatId) > 0
      )
    ) {
      return NextResponse.json(
        { error: "Invalid seat IDs" },
        { status: 400 }
      );
    }

    if (!["UPI", "CARD", "NETBANKING"].includes(method)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
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

    // Execute the PostgreSQL booking procedure.
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

    // Simulated payment failure: the procedure preserves the seat hold.
    if (!booking.p_payment_succeeded) {
      return NextResponse.json(
        { error: "Payment failed" },
        { status: 402 }
      );
    }

    return NextResponse.json(
      {
        bookingId: booking.p_booking_id,
        total: Number(booking.p_total),
      },
      { status: 201 }
    );
  } catch (error) {
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

    console.error("Booking API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
