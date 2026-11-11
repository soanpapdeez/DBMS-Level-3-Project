import { pool } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = Number(id);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return Response.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT
         s.seat_id,
         s.event_id,
         s.row_label,
         s.seat_number,
         s.category_id,
         c.name AS category_name,
         c.price,
         CASE
           WHEN s.status = 'HELD'
                AND s.hold_expires_at <= NOW()
             THEN 'AVAILABLE'
           ELSE s.status
         END AS display_status
       FROM seats s
       JOIN seat_categories c
         ON c.category_id = s.category_id
        AND c.event_id = s.event_id
       WHERE s.event_id = $1
       ORDER BY s.row_label, s.seat_number`,
      [eventId]
    );

    const seats = result.rows.map((row) => ({
      seatId: row.seat_id,
      eventId: row.event_id,
      rowLabel: row.row_label,
      seatNumber: row.seat_number,
      categoryId: row.category_id,
      categoryName: row.category_name,
      price: Number(row.price),
      status: row.display_status,
    }));

    return Response.json({ seats });
  } catch (error) {
    console.error("GET /api/events/:id/seats error:", error);

    return Response.json(
      { error: "Failed to fetch seats" },
      { status: 500 }
    );
  }
}