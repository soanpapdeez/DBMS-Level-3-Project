
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("q")?.trim() || null;
    const city = searchParams.get("city")?.trim() || null;

    const result = await pool.query(
      `SELECT
         event_id,
         title,
         description,
         starts_at,
         venue,
         city,
         total_seats,
         available_seats,
         min_price
       FROM v_event_availability
       WHERE status = 'PUBLISHED'
         AND (
           $1::TEXT IS NULL
           OR title ILIKE '%' || $1 || '%'
           OR description ILIKE '%' || $1 || '%'
         )
         AND (
           $2::TEXT IS NULL
           OR city ILIKE '%' || $2 || '%'
         )
       ORDER BY starts_at ASC`,
      [search, city]
    );

    const events = result.rows.map((row) => ({
      eventId: row.event_id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      venue: row.venue,
      city: row.city,
      totalSeats: Number(row.total_seats),
      availableSeats: Number(row.available_seats),
      minPrice: row.min_price === null ? null : Number(row.min_price),
    }));

    return Response.json({ events });
  } catch (error) {
    console.error("GET /api/events error:", error);

    return Response.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
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

  const { venueId, title, description, startsAt, categories } = body;

  if (!Number.isInteger(venueId) || venueId <= 0) {
    return NextResponse.json(
      { error: "Invalid venue ID" },
      { status: 400 }
    );
  }

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 150
  ) {
    return NextResponse.json(
      { error: "Title is required and must not exceed 150 characters" },
      { status: 400 }
    );
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid description" },
      { status: 400 }
    );
  }

  if (
    typeof startsAt !== "string" ||
    !Number.isFinite(Date.parse(startsAt))
  ) {
    return NextResponse.json(
      { error: "Invalid event start date" },
      { status: 400 }
    );
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json(
      { error: "At least one seat category is required" },
      { status: 400 }
    );
  }

  const usedRows = new Set<string>();

  for (const category of categories) {
    if (
      typeof category.name !== "string" ||
      !category.name.trim() ||
      category.name.trim().length > 50 ||
      typeof category.price !== "number" ||
      !Number.isFinite(category.price) ||
      category.price < 0 ||
      !Array.isArray(category.rows) ||
      category.rows.length === 0 ||
      !Number.isInteger(category.seatsPerRow) ||
      category.seatsPerRow <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid seat category details" },
        { status: 400 }
      );
    }

    for (const row of category.rows) {
      if (
        typeof row !== "string" ||
        !row.trim() ||
        row.trim().length > 5 ||
        usedRows.has(row.trim())
      ) {
        return NextResponse.json(
          { error: "Invalid or duplicate seat row label" },
          { status: 400 }
        );
      }

      usedRows.add(row.trim());
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      `INSERT INTO events
        (venue_id, organizer_id, title, description, starts_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING event_id, status`,
      [
        venueId,
        session.userId,
        title.trim(),
        description?.trim() || null,
        startsAt,
      ]
    );

    const event = eventResult.rows[0];

    for (const category of categories) {
      const categoryResult = await client.query(
        `INSERT INTO seat_categories
          (event_id, name, price)
         VALUES ($1, $2, $3)
         RETURNING category_id`,
        [event.event_id, category.name.trim(), category.price]
      );

      const categoryId = categoryResult.rows[0].category_id;

      for (const row of category.rows) {
        for (let seatNumber = 1; seatNumber <= category.seatsPerRow; seatNumber++) {
          await client.query(
            `INSERT INTO seats
              (event_id, category_id, row_label, seat_number)
             VALUES ($1, $2, $3, $4)`,
            [event.event_id, categoryId, row.trim(), seatNumber]
          );
        }
      }
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        eventId: event.event_id,
        status: event.status,
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK");

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String(error.code)
        : "";

    if (code === "23503") {
      return NextResponse.json(
        { error: "Venue does not exist" },
        { status: 400 }
      );
    }

    if (code === "23505") {
      return NextResponse.json(
        { error: "Duplicate category or seat details" },
        { status: 409 }
      );
    }

    console.error("POST /api/events error:", error);

    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
