import "server-only";
import { createHash } from "node:crypto";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { API_URL } from "@zoonk/utils/url";
import { after } from "next/server";
import { getApiDeploymentHeaders } from "../security/api-deployment";
import { FOLLOW_UP_SECRET_HEADER, type FollowUp } from "./follow-up-contract";

function getFollowUpKey(followUp: FollowUp): string {
  switch (followUp.kind) {
    case "prepareSession":
      return followUp.input.sessionId;
    case "prepareGoalLessons":
    case "rememberOnboarding":
      return followUp.input.goalId;
    case "writeLesson":
      return followUp.input.lessonId;
    case "classifyMistakeCause":
      return followUp.input.mistakeId;
    case "findMistakePattern":
      return followUp.input.language;
    case "rememberSession":
      return followUp.input.sessionId;
    case "checkDailyInsight":
      return followUp.input.date;
    case "checkFactSensitivity": {
      const wording = createHash("sha1").update(followUp.input.statement).digest("hex");
      return `${followUp.input.factId}:${wording}`;
    }
    case "voiceWord":
      return followUp.input.wordId;
    default:
      return followUp satisfies never;
  }
}

function askFor({
  db,
  followUp,
  requestedAt,
  userId,
}: {
  db: TransactionClient;
  followUp: FollowUp;
  requestedAt: Date;
  userId: string;
}) {
  const { input, kind } = followUp;
  const key = getFollowUpKey(followUp);

  return db.followUp.upsert({
    create: { input, key, kind, requestedAt, userId },
    update: { input, requestedAt, revision: { increment: 1 } },
    where: { userKindKey: { key, kind, userId } },
  });
}

/** A failed start leaves the rows for the learner's next write or the daily sweep. */
async function startFollowUps(userId: string): Promise<void> {
  const secret = process.env.APP_FOLLOW_UP_SECRET;

  if (!secret) {
    logError("APP_FOLLOW_UP_SECRET is missing, so follow-ups wait for the daily sweep.");
    return;
  }

  const { data: response, error } = await safeAsync(async () =>
    fetch(`${API_URL}/internal/follow-ups`, {
      body: JSON.stringify({ userId }),
      cache: "no-store",
      headers: {
        ...(await getApiDeploymentHeaders()),
        "Content-Type": "application/json",
        [FOLLOW_UP_SECRET_HEADER]: secret,
      },
      method: "POST",
    }),
  );

  await response?.body?.cancel();

  if (error || !response.ok) {
    logError(`Could not start learner ${userId}'s follow-ups.`, error ?? response.status);
  }
}

/**
 * Pass the transaction that decides the write, so a rolled-back write owes nothing. The same work
 * still pending is asked again instead of added twice. `userId` must come from the capability that
 * authorized the write.
 */
export async function oweFollowUps({
  db = prisma,
  followUps,
  userId,
}: {
  db?: TransactionClient;
  followUps: readonly FollowUp[];
  userId: string;
}): Promise<void> {
  if (followUps.length === 0) {
    return;
  }

  const requestedAt = new Date();

  await Promise.all(followUps.map((followUp) => askFor({ db, followUp, requestedAt, userId })));

  after(() => startFollowUps(userId));
}
