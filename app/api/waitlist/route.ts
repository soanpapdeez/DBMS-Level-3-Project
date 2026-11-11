import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET: View waitlist for an event
export async function GET(request: NextRequest) {
  try {
    const eventId = Number(
      new URL(request.url).searchParams.get("eventId")
    );

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return NextResponse.json(
        { error: "Valid eventId required" },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT waitlist_id, event_id, user_id, status, joined_at
       FROM waitlist
       WHERE event_id = $1
       ORDER BY joined_at ASC`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      waitlist: result.rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to fetch waitlist" },
      { status: 500 }
    );
  }
}

// POST: Join waitlist
export async function POST(request: NextRequest) {
  try {
    const { eventId, userId } = await request.json();

    if (
      !Number.isInteger(Number(eventId)) ||
      Number(eventId) <= 0 ||
      !Number.isInteger(Number(userId)) ||
      Number(userId) <= 0
    ) {
      return NextResponse.json(
        { error: "Valid eventId and userId required" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO waitlist (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING
       RETURNING waitlist_id, event_id, user_id, status`,
      [Number(eventId), Number(userId)]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "User is already on this event's waitlist" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Successfully joined waitlist",
        entry: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to join waitlist" },
      { status: 500 }
    );
  }
}