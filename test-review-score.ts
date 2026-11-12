import { logAttempt, getRiskScore, getRiskAction } from "./lib/antiScalping";

async function main() {
  const device = "a48f89b7-340b-4156-ba71-b4b981631ead";

  for (let i = 0; i < 10; i++) {
    await logAttempt({
      userId: "1",
      eventId: "1",
      ip: "unknown",
      deviceFingerprint: device,
      outcome: "pending",
    });
  }

  const score = await getRiskScore({
    userId: "1",
    ip: "unknown",
    deviceFingerprint: device,
  });

  console.log("REVIEW SCORE:", score);
  console.log("REVIEW ACTION:", getRiskAction(score));
}

main().catch(console.error);
