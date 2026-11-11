
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";


export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT
        t.ticket_id,
        t.ticket_code,
        t.status AS ticket_status,
        t.face_value,
        t.issued_at,
        b.booking_id,
        e.event_id,
        e.title AS event_title,
        e.starts_at,
        v.name AS venue,
        v.city,
        s.row_label,
        s.seat_number,
        c.name AS category_name
      FROM tickets t
      JOIN bookings b
        ON b.booking_id = t.booking_id
      JOIN events e
        ON e.event_id = b.event_id
      JOIN venues v
        ON v.venue_id = e.venue_id
      JOIN seats s
        ON s.seat_id = t.seat_id
      JOIN seat_categories c
        ON c.category_id = s.category_id
       AND c.event_id = s.event_id
      WHERE t.owner_id = $1
      ORDER BY t.issued_at DESC`,
      [session.userId]
    );

    const tickets = result.rows.map((row) => ({
      ticketId: row.ticket_id,
      ticketCode: row.ticket_code,
      status: row.ticket_status,
      faceValue: Number(row.face_value),
      issuedAt: row.issued_at,
      bookingId: row.booking_id,
      eventId: row.event_id,
      title: row.event_title,
      startsAt: row.starts_at,
      venue: row.venue,
      city: row.city,
      rowLabel: row.row_label,
      seatNumber: row.seat_number,
      category: row.category_name,
    }));

    return NextResponse.json({ tickets }, { status: 200 });
  } catch (error) {
    console.error("My Tickets API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
