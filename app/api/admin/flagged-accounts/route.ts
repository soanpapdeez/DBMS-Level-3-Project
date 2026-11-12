
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

// GET: View flagged accounts (admin only)
export async function GET() {
  try {
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

    const result = await query(
      `SELECT * FROM v_flagged_users
       ORDER BY flagged_at DESC`
    );

    return NextResponse.json({
      success: true,
      flaggedAccounts: result.rows,
    });
  } catch (error) {
    console.error("Flagged accounts error:", error);
    return NextResponse.json(
      { error: "Unable to fetch flagged accounts" },
      { status: 500 }
    );
  }
}

// PATCH: Clear a flag or ban an account (admin only)
export async function PATCH(request: NextRequest) {
  try {
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

    const { flagId, action } = await request.json();

    if (
      !Number.isInteger(Number(flagId)) ||
      !["CLEARED", "BANNED"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Invalid flagId or action" },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE flagged_accounts
       SET status = $1,
           reviewed_by = $2,
           reviewed_at = NOW()
       WHERE flag_id = $3
         AND status = 'OPEN'
       RETURNING user_id`,
      [action, session.userId, Number(flagId)]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Open flag not found" },
        { status: 404 }
      );
    }

    if (action === "BANNED") {
      await query(
        `UPDATE users SET is_banned = TRUE WHERE user_id = $1`,
        [result.rows[0].user_id]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Account flag ${action.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error("Flag management error:", error);
    return NextResponse.json(
      { error: "Unable to update flagged account" },
      { status: 500 }
    );
  }
}
