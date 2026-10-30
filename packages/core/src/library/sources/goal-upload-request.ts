import "server-only";
import { type Goal, type GoalKind, type ResearchUploadReason, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { type ExamDocument, getExamDocument } from "../../exams/exam-document";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getOwnedGoal } from "../../learner/get-owned-goal";
import { getSession } from "../../users/get-session";
import { type ResearchAccess, getResearchAccess } from "../exams/research-access";

export type GoalUploadRequest = {
  examDocument: ExamDocument;
  goalId: string;
  goalKind: GoalKind;
  language: string;
  reason: ResearchUploadReason;
};

export type GoalUploadRequestResult =
  | { status: "notFound" | "unauthorized" }
  | { request: GoalUploadRequest | null; status: "ready" };

export function toGoalUploadRequest(goal: Goal): GoalUploadRequest | null {
  return goal.researchUploadReason
    ? {
        examDocument: getExamDocument(goal),
        goalId: goal.id,
        goalKind: goal.kind,
        language: goal.language,
        reason: goal.researchUploadReason,
      }
    : null;
}

export async function getGoalUploadRequest({
  goalId,
}: {
  goalId: string;
}): Promise<GoalUploadRequestResult> {
  "use cache: private";

  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  return { request: toGoalUploadRequest(owned.goal), status: "ready" };
}

export async function dismissGoalUploadRequest({
  goalId,
}: {
  goalId: string;
}): Promise<{ status: "dismissed" | "notFound" | "unauthorized" }> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  await writeLearnerChange({ userId: owned.userId }, async (tx) => {
    const { count } = await tx.goal.updateMany({
      data: { researchUploadReason: null },
      where: { id: goalId, researchUploadReason: { not: null }, userId: owned.userId },
    });

    return count === 0 ? unchanged(null) : null;
  });

  revalidateCacheTags([getGoalsCacheTag(owned.userId)]);

  return { status: "dismissed" };
}

export async function answerGoalUploadRequest({
  goalId,
  sourceIds = [],
}: {
  goalId: string;
  sourceIds?: string[];
}): Promise<ResearchAccess | { status: "noUploadRequest" }> {
  const [access, session] = await Promise.all([
    getResearchAccess({ goalId, sourceIds }),
    getSession(),
  ]);

  if (access.status !== "ready" || access.sourceIds.length === 0 || !session) {
    return access;
  }

  const userId = session.user.id;

  const answered = await writeLearnerChange({ userId }, async (transaction) => {
    const { count } = await transaction.goal.updateMany({
      data: { researchUploadReason: null },
      where: { id: goalId, researchUploadReason: { not: null }, userId },
    });

    if (count === 0) {
      return unchanged(false);
    }

    await transaction.learnerSource.createMany({
      data: access.sourceIds.map((sourceId) => ({ goalId, origin: "upload", sourceId, userId })),
      skipDuplicates: true,
    });

    await transaction.learnerSource.updateMany({
      data: { goalId },
      where: { goalId: null, sourceId: { in: access.sourceIds }, userId },
    });

    return true;
  });

  if (answered) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }

  return answered ? access : { status: "noUploadRequest" };
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function recordGoalResearchRun({
  goalId,
  runId,
}: {
  goalId: string;
  runId: string;
}): Promise<void> {
  await prisma.goal.updateMany({ data: { researchRunId: runId }, where: { id: goalId } });
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function recordGoalResearchOutcome({
  goalId,
  uploadReason,
}: {
  goalId: string;
  uploadReason: ResearchUploadReason | null;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  await writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findFirst({ where: { id: goalId, userId: goal.userId } });

    if (!current || current.researchUploadReason === uploadReason) {
      return unchanged(null);
    }

    const { count } = await tx.goal.updateMany({
      data: { researchUploadReason: uploadReason },
      where: { id: goalId, userId: goal.userId },
    });

    return count === 0 ? unchanged(null) : null;
  });
}
