
import { ObjectId } from "mongodb";
import { getMongoDb } from "./mongo";

export interface AttemptInput {
  userId: string;
  eventId: string;
  ip: string;
  deviceFingerprint: string;
  outcome: string;
}

interface PurchaseAttempt extends AttemptInput {
  timestamp: Date;
  attemptsPerMinute: number;
}

let indexesPromise: Promise<void> | null = null;

export async function ensureAntiScalpingIndexes(): Promise<void> {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const db = await getMongoDb();
      const collection = db.collection("purchase_attempts");

      await Promise.all([
        collection.createIndex({ userId: 1, timestamp: -1 }),
        collection.createIndex({ ip: 1, timestamp: -1 }),
        collection.createIndex({ deviceFingerprint: 1, timestamp: -1 }),
        collection.createIndex({ outcome: 1, timestamp: -1 }),
        collection.createIndex({ eventId: 1, timestamp: -1 }),
      ]);
    })().catch((error) => {
      indexesPromise = null;
      throw error;
    });
  }

  await indexesPromise;
}

export async function logAttempt(
  input: AttemptInput
): Promise<string> {
  await ensureAntiScalpingIndexes();

  const db = await getMongoDb();
  const collection = db.collection<PurchaseAttempt>("purchase_attempts");

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);

  const attempts = await collection.countDocuments({
    userId: input.userId,
    timestamp: { $gte: oneMinuteAgo },
  });

  const result = await collection.insertOne({
    ...input,
    timestamp: now,
    attemptsPerMinute: attempts + 1,
  });

  return result.insertedId.toString();
}

export async function updateAttemptOutcome(
  attemptId: string,
  outcome: string
): Promise<void> {
  if (!ObjectId.isValid(attemptId)) {
    throw new Error("Invalid purchase attempt ID");
  }

  const db = await getMongoDb();

  const result = await db.collection("purchase_attempts").updateOne(
    { _id: new ObjectId(attemptId) },
    { $set: { outcome, updatedAt: new Date() } }
  );

  if (result.matchedCount !== 1) {
    throw new Error("Purchase attempt record not found");
  }
}

export async function getRiskScore({
  userId,
  ip,
  deviceFingerprint,
}: {
  userId: string;
  ip: string;
  deviceFingerprint: string;
}): Promise<number> {
  await ensureAntiScalpingIndexes();

  const db = await getMongoDb();
  const collection = db.collection("purchase_attempts");

  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60_000);

  const [
    recentAttempts,
    deviceAccounts,
    ipAccounts,
    rejectedAttempts,
  ] = await Promise.all([
    collection.countDocuments({
      userId,
      timestamp: { $gte: oneMinuteAgo },
    }),
    collection.distinct("userId", {
      deviceFingerprint,
      timestamp: { $gte: twentyFourHoursAgo },
    }),
    collection.distinct("userId", {
      ip,
      timestamp: { $gte: twentyFourHoursAgo },
    }),
    collection.countDocuments({
      userId,
      outcome: "rejected",
      timestamp: { $gte: tenMinutesAgo },
    }),
  ]);

  let score = 0;

  if (recentAttempts >= 10) score += 40;
  if (deviceAccounts.length >= 3) score += 30;
  if (ipAccounts.length >= 5) score += 25;
  if (rejectedAttempts >= 5) score += 15;

  return Math.min(score, 100);
}

export function getRiskAction(
  score: number
): "ALLOW" | "REVIEW" | "BLOCK" {
  if (score >= 80) return "BLOCK";
  if (score >= 50) return "REVIEW";
  return "ALLOW";
}

export async function getSuspiciousSources() {
  await ensureAntiScalpingIndexes();

  const db = await getMongoDb();
  const collection = db.collection("purchase_attempts");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [suspiciousDevices, suspiciousIPs] = await Promise.all([
    collection.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: "$deviceFingerprint",
          accounts: { $addToSet: "$userId" },
          attempts: { $sum: 1 },
        },
      },
      {
        $project: {
          deviceFingerprint: "$_id",
          accountCount: { $size: "$accounts" },
          attempts: 1,
          _id: 0,
        },
      },
      { $match: { accountCount: { $gte: 3 } } },
      { $sort: { accountCount: -1 } },
    ]).toArray(),

    collection.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: "$ip",
          accounts: { $addToSet: "$userId" },
          attempts: { $sum: 1 },
        },
      },
      {
        $project: {
          ip: "$_id",
          accountCount: { $size: "$accounts" },
          attempts: 1,
          _id: 0,
        },
      },
      { $match: { accountCount: { $gte: 5 } } },
      { $sort: { accountCount: -1 } },
    ]).toArray(),
  ]);

  return { suspiciousDevices, suspiciousIPs };
}
