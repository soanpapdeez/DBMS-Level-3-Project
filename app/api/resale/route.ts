
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET: View all active resale listings
export async function GET() {
  try {
    const result = await query(
      `SELECT listing_id, ticket_id, seller_id, ask_price, listed_at
       FROM resale_listings
       WHERE status = 'ACTIVE'
       ORDER BY listed_at DESC`
    );

    return NextResponse.json({
      success: true,
      listings: result.rows,
    });
  } catch (error) {
    console.error("Resale listing error:", error);
    return NextResponse.json(
      { error: "Unable to fetch resale listings" },
      { status: 500 }
    );
  }
}

// POST: List a ticket for resale
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticketId, sellerId, askPrice } = body;

    if (
      !Number.isInteger(Number(ticketId)) ||
      !Number.isInteger(Number(sellerId)) ||
      !Number.isFinite(Number(askPrice)) ||
      Number(askPrice) <= 0
    ) {
      return NextResponse.json(
        { error: "Valid ticketId, sellerId and askPrice are required" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO resale_listings (ticket_id, seller_id, ask_price)
       VALUES ($1, $2, $3)
       RETURNING listing_id, ticket_id, seller_id, ask_price, status`,
      [Number(ticketId), Number(sellerId), Number(askPrice)]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Ticket listed for resale",
        listing: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create resale listing error:", error);
    return NextResponse.json(
      { error: "Unable to create listing. Check ticket ownership and resale rules." },
      { status: 400 }
    );
  }
}

// DELETE: Cancel your own resale listing
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = Number(searchParams.get("listingId"));
    const sellerId = Number(searchParams.get("sellerId"));

    if (
      !Number.isInteger(listingId) || listingId <= 0 ||
      !Number.isInteger(sellerId) || sellerId <= 0
    ) {
      return NextResponse.json(
        { error: "Valid listingId and sellerId are required" },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE resale_listings
       SET status = 'CANCELLED', closed_at = NOW()
       WHERE listing_id = $1
         AND seller_id = $2
         AND status = 'ACTIVE'
       RETURNING listing_id`,
      [listingId, sellerId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Active listing not found or not owned by this seller" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Resale listing cancelled",
    });
  } catch (error) {
    console.error("Cancel resale listing error:", error);
    return NextResponse.json(
      { error: "Unable to cancel listing" },
      { status: 500 }
    );
  }
}
