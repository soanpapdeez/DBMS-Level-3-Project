
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = Number(id);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return Response.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT
         event_id, title, description, starts_at, venue, city,
         total_seats, available_seats, min_price
       FROM v_event_availability
       WHERE event_id = $1 AND status = 'PUBLISHED'`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    const row = result.rows[0];

    return Response.json({
      event: {
        eventId: row.event_id,
        title: row.title,
        description: row.description,
        startsAt: row.starts_at,
        venue: row.venue,
        city: row.city,
        totalSeats: Number(row.total_seats),
        availableSeats: Number(row.available_seats),
        minPrice: row.min_price === null ? null : Number(row.min_price),
      },
    });
  } catch (error) {
    console.error("GET /api/events/:id error:", error);
    return Response.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    if (session.role !== "ADMIN") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const eventId = Number(id);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return Response.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const allowedFields = ["title", "description", "startsAt", "venueId", "status"];

    if (
      Object.keys(body).length === 0 ||
      Object.keys(body).some((key) => !allowedFields.includes(key))
    ) {
      return Response.json(
        { error: "Provide valid event fields to update" },
        { status: 400 }
      );
    }

    if (
      "title" in body &&
      (typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.length > 150)
    ) {
      return Response.json({ error: "Invalid event title" }, { status: 400 });
    }

    if (
      "description" in body &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return Response.json({ error: "Invalid description" }, { status: 400 });
    }

    if (
      "startsAt" in body &&
      (typeof body.startsAt !== "string" ||
        !Number.isFinite(Date.parse(body.startsAt)))
    ) {
      return Response.json({ error: "Invalid start date" }, { status: 400 });
    }

    if (
      "venueId" in body &&
      (!Number.isInteger(body.venueId) || body.venueId <= 0)
    ) {
      return Response.json({ error: "Invalid venue ID" }, { status: 400 });
    }

    const validStatuses = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"];

    if (
      "status" in body &&
      (typeof body.status !== "string" ||
        !validStatuses.includes(body.status))
    ) {
      return Response.json({ error: "Invalid event status" }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE events
       SET title = COALESCE($2, title),
           description = CASE WHEN $3 THEN $4 ELSE description END,
           starts_at = COALESCE($5, starts_at),
           venue_id = COALESCE($6, venue_id),
           status = COALESCE($7, status)
       WHERE event_id = $1
       RETURNING event_id, title, description, starts_at, venue_id, status`,
      [
        eventId,
        body.title === undefined ? null : body.title.trim(),
        "description" in body,
        body.description ?? null,
        body.startsAt ?? null,
        body.venueId ?? null,
        body.status ?? null,
      ]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    const row = result.rows[0];

    return Response.json({
      event: {
        eventId: row.event_id,
        title: row.title,
        description: row.description,
        startsAt: row.starts_at,
        venueId: row.venue_id,
        status: row.status,
      },
    });
  } catch (error: unknown) {
    console.error("PATCH /api/events/:id error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503"
    ) {
      return Response.json({ error: "Venue does not exist" }, { status: 400 });
    }

    return Response.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (session.role !== "ADMIN") {
      return Response.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const eventId = Number(id);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return Response.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `DELETE FROM events
       WHERE event_id = $1
       RETURNING event_id, title`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return Response.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return Response.json({
      message: "Event deleted successfully",
      event: {
        eventId: result.rows[0].event_id,
        title: result.rows[0].title,
      },
    });
  } catch (error: unknown) {
    console.error("DELETE /api/events/:id error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503"
    ) {
      return Response.json(
        { error: "Cannot delete an event with existing bookings or references" },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
