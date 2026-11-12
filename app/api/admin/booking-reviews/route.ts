
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await pool.query(
      `SELECT
         review_id, user_id, event_id, seat_ids,
         payment_method, device_fingerprint, ip_address,
         risk_score, status, created_at
       FROM booking_reviews
       WHERE status = 'PENDING'
       ORDER BY risk_score DESC, created_at ASC`
    );

    return NextResponse.json({ reviews: result.rows });
  } catch (error) {
    console.error("Booking reviews GET error:", error);
    return NextResponse.json(
      { error: "Unable to retrieve booking reviews" },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reviewId, action } = body;

  if (
    !Number.isInteger(reviewId) ||
    reviewId <= 0 ||
    !["APPROVE", "REJECT"].includes(action)
  ) {
    return NextResponse.json(
      { error: "Valid reviewId and APPROVE/REJECT action are required" },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reviewResult = await client.query(
      `SELECT *
       FROM booking_reviews
       WHERE review_id = $1
       FOR UPDATE`,
      [reviewId]
    );

    if (reviewResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const review = reviewResult.rows[0];

    if (review.status !== "PENDING") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "This review has already been processed" },
        { status: 409 }
      );
    }

    if (action === "REJECT") {
      await client.query(
        `UPDATE booking_reviews
         SET status = 'REJECTED', reviewed_by = $2, reviewed_at = NOW()
         WHERE review_id = $1`,
        [reviewId, session.userId]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        message: "Booking review rejected",
        status: "REJECTED",
      });
    }

    // Reacquire the seats. The original five-minute hold may have expired.
    await client.query(
      `SELECT hold_seats($1, $2, $3)`,
      [review.user_id, review.event_id, review.seat_ids]
    );

    // Execute the existing booking procedure only after reacquiring the hold.
    const bookingResult = await client.query(
      `CALL book_tickets(
        $1, $2, $3, $4, $5,
        NULL::integer,
        NULL::numeric,
        NULL::boolean
      )`,
      [
        review.user_id,
        review.event_id,
        review.seat_ids,
        review.payment_method,
        review.simulate_failure,
      ]
    );

    const booking = bookingResult.rows[0];

    if (!booking.p_payment_succeeded) {
      await client.query(
        `UPDATE booking_reviews
         SET status = 'PAYMENT_FAILED',
             reviewed_by = $2,
             reviewed_at = NOW()
         WHERE review_id = $1`,
        [reviewId, session.userId]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        { error: "Payment failed during approval", status: "PAYMENT_FAILED" },
        { status: 402 }
      );
    }

    await client.query(
      `UPDATE booking_reviews
       SET status = 'APPROVED',
           reviewed_by = $2,
           reviewed_at = NOW(),
           booking_id = $3
       WHERE review_id = $1`,
      [reviewId, session.userId, booking.p_booking_id]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Booking approved and completed",
      status: "APPROVED",
      bookingId: booking.p_booking_id,
      total: Number(booking.p_total),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String(error.code)
        : "";

    console.error("Booking review PATCH error:", error);

    if (code === "TK409") {
      return NextResponse.json(
        { error: "Seats are no longer available; review cannot be approved" },
        { status: 409 }
      );
    }

    if (code === "TK400" || code === "TK403") {
      return NextResponse.json(
        { error: "Booking could not be approved" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to process booking review" },
      { status: 503 }
    );
  } finally {
    client.release();
  }
}
