import { pool } from "@/lib/db";
import { createToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT u.user_id, u.full_name, u.email,
              u.password_hash, u.is_banned, r.name AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rowCount !== 1) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.is_banned) {
      return NextResponse.json(
        { error: "This account has been suspended" },
        { status: 403 }
      );
    }

    const token = await createToken({
      userId: user.user_id,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        userId: user.user_id,
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);

    return NextResponse.json(
      { error: "Failed to log in" },
      { status: 500 }
    );
  }
}
