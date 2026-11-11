import { pool } from "@/lib/db";
import { createToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    if (name.length > 100 || email.length > 255 || password.length < 8) {
      return NextResponse.json(
        { error: "Invalid name, email or password length" },
        { status: 400 }
      );
    }

    const customerRole = await pool.query(
      "SELECT role_id FROM roles WHERE name = 'CUSTOMER'"
    );

    if (customerRole.rowCount !== 1) {
      throw new Error("CUSTOMER role is not configured");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (role_id, full_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, full_name, email, role_id`,
      [customerRole.rows[0].role_id, name, email, passwordHash]
    );

    const user = result.rows[0];
    const token = await createToken({
      userId: user.user_id,
      role: "CUSTOMER",
    });

    const response = NextResponse.json(
      {
        user: {
          userId: user.user_id,
          name: user.full_name,
          email: user.email,
          role: "CUSTOMER",
        },
      },
      { status: 201 }
    );

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    console.error("POST /api/auth/register error:", error);

    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}