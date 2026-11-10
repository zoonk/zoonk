import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";

const CLAIM_TTL_MS = 360_000;

/** A grade is cached before answer recording; retries after a recording failure reuse it. */
export async function runMistakeGrade({
  attemptId,
  cacheWithoutModelClaim = false,
  grade,
  questionId,
  userId,
}: {
  attemptId: string;
  cacheWithoutModelClaim?: boolean;
  grade: () => Promise<JsonObject>;
  questionId: string;
  userId: string;
}): Promise<{ result: JsonObject; status: "ready" } | { status: "retryable" }> {
  const key = `mistake-grade:${attemptId}`;
  const claimedAt = new Date();

  const claim = await writeLearnerChange<
    { status: "claimed" },
    { status: "saved"; result: JsonObject } | { status: "taken" }
  >({ userId }, async (tx) => {
    const saved = await tx.modelGrade.findUnique({ where: { id: attemptId } });

    if (saved && isJsonObject(saved.result)) {
      return unchanged({ result: saved.result, status: "saved" as const });
    }

    const liveSince = new Date(claimedAt.getTime() - CLAIM_TTL_MS);
    const existing = await tx.testSubmissionClaim.findUnique({ where: { key } });

    if (existing && existing.createdAt > liveSince) {
      return unchanged({ status: "taken" as const });
    }

    await tx.testSubmissionClaim.upsert({
      create: { createdAt: claimedAt, key, userId },
      update: { createdAt: claimedAt },
      where: { key },
    });

    return { status: "claimed" as const };
  });

  if (claim.status === "saved") {
    return { result: claim.result, status: "ready" };
  }

  if (claim.status === "taken") {
    return { status: "retryable" };
  }

  const { data, error } = await safeAsync(grade);

  if (error) {
    await prisma.testSubmissionClaim.deleteMany({ where: { createdAt: claimedAt, key, userId } });
    throw error;
  }

  if (!data) {
    throw new Error("A mistake grade returned no result");
  }

  return writeLearnerChange({ userId }, async (tx) => {
    const owned = await tx.testSubmissionClaim.deleteMany({
      where: { createdAt: claimedAt, key, userId },
    });

    if (owned.count === 0) {
      return unchanged({ status: "retryable" as const });
    }

    const admitted = await tx.modelGrade.findUnique({
      select: { id: true },
      where: { id: attemptId },
    });

    if (!admitted && !cacheWithoutModelClaim) {
      return { result: data, status: "ready" as const };
    }

    await tx.modelGrade.upsert({
      create: { id: attemptId, questionId, result: data, userId },
      update: { result: data },
      where: { id: attemptId },
    });

    return { result: data, status: "ready" as const };
  });
}
