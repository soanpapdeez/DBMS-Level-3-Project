
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";


export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return Response.json({ user: null });
    }

    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, r.name AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1
         AND u.is_banned = FALSE`,
      [session.userId]
    );

    if (result.rowCount !== 1) {
      return Response.json({ user: null });
    }

    const user = result.rows[0];

    return Response.json({
      user: {
        userId: user.user_id,
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);

    return Response.json(
      { error: "Failed to fetch user session" },
      { status: 500 }
    );
  }
}
