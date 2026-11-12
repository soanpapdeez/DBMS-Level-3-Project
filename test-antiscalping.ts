
import {
  logAttempt,
  getRiskScore,
  getRiskAction,
} from "./lib/antiScalping";

async function main() {
  const userId = "atlas-final-test-user";
  const ip = "192.0.2.250";
  const device = "atlas-final-test-device";

  try {
    // Five rejected attempts = 15 points.
    for (let i = 0; i < 5; i++) {
      await logAttempt({
        userId,
        eventId: "final-test",
        ip,
        deviceFingerprint: device,
        outcome: "rejected",
      });
    }

    // Three accounts sharing device = 30 points.
    for (let i = 1; i <= 3; i++) {
      await logAttempt({
        userId: `final-device-user-${i}`,
        eventId: "final-test",
        ip: `192.0.2.${i}`,
        deviceFingerprint: device,
        outcome: "pending",
      });
    }

    // Five accounts sharing IP = 25 points.
    for (let i = 1; i <= 5; i++) {
      await logAttempt({
        userId: `final-ip-user-${i}`,
        eventId: "final-test",
        ip,
        deviceFingerprint: `final-ip-device-${i}`,
        outcome: "pending",
      });
    }

    const score = await getRiskScore({ userId, ip, deviceFingerprint: device });

    console.log("FINAL RISK SCORE:", score);
    console.log("FINAL ACTION:", getRiskAction(score));

  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exitCode = 1;
  }
}

main();
