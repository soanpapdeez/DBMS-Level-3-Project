
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSuspiciousSources } from "@/lib/antiScalping";

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

    const {
      suspiciousDevices,
      suspiciousIPs,
    } = await getSuspiciousSources();

    return NextResponse.json({
      success: true,
      summary: {
        suspiciousDeviceCount: suspiciousDevices.length,
        suspiciousIPCount: suspiciousIPs.length,
      },
      suspiciousDevices,
      suspiciousIPs,
    });
  } catch (error) {
    console.error("Fraud signals API error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve fraud signals" },
      { status: 503 }
    );
  }
}
