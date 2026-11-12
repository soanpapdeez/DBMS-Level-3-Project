import {
  logAttempt,
  getRiskScore,
  getRiskAction,
} from "./lib/antiScalping";

async function main() {
  const userId = "atlas-block-test";
  const ip = "192.0.2.250";
  const device = "atlas-block-device";

  for (let i = 0; i < 10; i++) {
    await logAttempt({
      userId,
      eventId: "block-test",
      ip,
      deviceFingerprint: device,
      outcome: "rejected",
    });
  }

  for (let i = 1; i <= 3; i++) {
    await logAttempt({
      userId: `block-device-user-${i}`,
      eventId: "block-test",
      ip: `192.0.2.${i}`,
      deviceFingerprint: device,
      outcome: "pending",
    });
  }

  for (let i = 1; i <= 5; i++) {
    await logAttempt({
      userId: `block-ip-user-${i}`,
      eventId: "block-test",
      ip,
      deviceFingerprint: `block-ip-device-${i}`,
      outcome: "pending",
    });
  }

  const score = await getRiskScore({ userId, ip, deviceFingerprint: device });

  console.log("BLOCK TEST SCORE:", score);
  console.log("BLOCK TEST ACTION:", getRiskAction(score));
}

main().catch(console.error);
