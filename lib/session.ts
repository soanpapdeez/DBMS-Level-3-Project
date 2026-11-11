import { cookies } from "next/headers";
import { verifyToken, type SessionPayload } from "@/lib/auth";

export const SESSION_COOKIE = "ticket_session";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}