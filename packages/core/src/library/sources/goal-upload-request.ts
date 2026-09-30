import "server-only";
import { type GoalKind, type ResearchUploadReason, prisma } from "@zoonk/db";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getSession } from "../../users/get-session";
import { type ResearchAccess, getResearchAccess } from "../exams/research-access";

/**
 * What Plan and Today ask when research couldn't find what a goal is built from: the exam's
 * official notice, a law's or a product's official source, or, for a teacher's test, the class's
 * own material. `reason` says why, so the ask says it too.
 */
export type GoalUploadRequest = {
  goalId: string;
  goalKind: GoalKind;
  /** The goal's language, for uploads whose documents don't say their own. */
  language: string;
  reason: ResearchUploadReason;
};

export type GoalUploadRequestResult =
  | { status: "notFound" | "unauthorized" }
  | { request: GoalUploadRequest | null; status: "ready" };

/**
 * The upload research is waiting for on one of the learner's goals, or null when it needs
 * nothing. It's read fresh on every visit: research sets it from a workflow, and answering or
 * dismissing clears it, so the card disappears as soon as the learner acts.
 */
export async function getGoalUploadRequest({
  goalId,
}: {
  goalId: string;
}): Promise<GoalUploadRequestResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  const request = goal.researchUploadReason
    ? {
        goalId: goal.id,
        goalKind: goal.kind,
        language: goal.language,
        reason: goal.researchUploadReason,
      }
    : null;

  return { request, status: "ready" };
}

/**
 * The learner doesn't have the document (the notice isn't out yet, the teacher shared nothing):
 * the ask leaves Plan and Today, and the plan keeps following the goal as typed.
 */
export async function dismissGoalUploadRequest({
  goalId,
}: {
  goalId: string;
}): Promise<{ status: "dismissed" | "notFound" | "unauthorized" }> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  await prisma.goal.update({ data: { researchUploadReason: null }, where: { id: goalId } });

  return { status: "dismissed" };
}

/**
 * The learner answers research's ask with the documents they uploaded (or a shared one they
 * picked): each is linked to the goal as its material, so the rebuilt curriculum reads it, and
 * the ask is cleared at once. The delivery app then starts research with these sources. Uploads
 * only answer an open ask, once (`noUploadRequest` otherwise), since each answer rebuilds the
 * goal. Without sources, it only checks the learner may start research for the goal.
 */
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

  const answered = await prisma.$transaction(async (transaction) => {
    const { count } = await transaction.goal.updateMany({
      data: { researchUploadReason: null },
      where: { id: goalId, researchUploadReason: { not: null } },
    });

    if (count === 0) {
      return false;
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

  return answered ? access : { status: "noUploadRequest" };
}

/**
 * Remembers the run researching a goal, so asking for research again follows it instead of
 * starting another.
 *
 * This is a workflow bridge: research runs for a goal the public boundary already checked.
 */
export async function recordGoalResearchRun({
  goalId,
  runId,
}: {
  goalId: string;
  runId: string;
}): Promise<void> {
  await prisma.goal.updateMany({ data: { researchRunId: runId }, where: { id: goalId } });
}

/**
 * Keeps the goal's ask in step with its last research run: set when research needs an upload,
 * cleared when it found what it needed or needs nothing. A goal deleted meanwhile is skipped.
 *
 * This is a workflow bridge: research runs for a goal the public boundary already checked.
 */
export async function recordGoalResearchOutcome({
  goalId,
  uploadReason,
}: {
  goalId: string;
  uploadReason: ResearchUploadReason | null;
}): Promise<void> {
  await prisma.goal.updateMany({
    data: { researchUploadReason: uploadReason },
    where: { id: goalId },
  });
}
