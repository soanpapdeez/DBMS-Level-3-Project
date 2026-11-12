import { logAttempt } from "./lib/antiScalping";

async function main() {
  const device = "a48f89b7-340b-4156-ba71-b4b981631ead";

  for (let i = 1; i <= 3; i++) {
    await logAttempt({
      userId: `review-device-test-${i}`,
      eventId: "1",
      ip: `192.0.2.${i}`,
      deviceFingerprint: device,
      outcome: "pending",
    });
  }

  console.log("REVIEW device signals inserted.");
}

main().catch(console.error);
