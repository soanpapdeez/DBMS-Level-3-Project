import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET is not configured");
}

const secretKey = new TextEncoder().encode(secret);

export interface SessionPayload {
  userId: number;
  role: "CUSTOMER" | "ADMIN" | "STAFF";
}

export async function createToken(payload: SessionPayload) {
  return new SignJWT({
    userId: payload.userId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);

    if (
      typeof payload.userId !== "number" ||
      !["CUSTOMER", "ADMIN", "STAFF"].includes(payload.role as string)
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role as SessionPayload["role"],
    };
  } catch {
    return null;
  }
}