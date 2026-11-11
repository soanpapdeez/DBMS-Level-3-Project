
import { NextResponse } from "next/server";
import { getSuspiciousSources } from "@/lib/antiScalping";

export async function GET() {
  try {
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
      {
        success: false,
        error: "Unable to retrieve fraud signals",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
