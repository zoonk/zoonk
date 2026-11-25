import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type GoalKind, type ResearchUploadReason, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { type ExamDocument, getExamDocument } from "../../exams/exam-document";
import { recordFollowUps } from "../../follow-ups/owe-follow-ups";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getOwnedGoal } from "../../learner/get-owned-goal";
import { getSession } from "../../users/get-session";
import { type ResearchAccess, getResearchAccess } from "../exams/research-access";
import { linkGoalSources } from "./link-goal-sources";
import { getSourceReadStatus } from "./source-read-status";

export type GoalUploadRequest = {
  examDocument: ExamDocument;
  goalId: string;
  goalKind: GoalKind;
  language: string;
  reason: ResearchUploadReason;
  unreadableUpload: { title: string } | null;
};

export type GoalUploadRequestResult =
  | { status: "notFound" | "unauthorized" }
  | { request: GoalUploadRequest | null; status: "ready" };

async function findLatestUnreadableUpload(goalId: string) {
  const answered = await prisma.goalSource.findMany({
    orderBy: { answeredAt: "desc" },
    select: { source: { select: { extractedText: true, readState: true, title: true } } },
    where: { answeredAt: { not: null }, goalId, origin: "upload" },
  });

  const latest = answered.find(({ source }) => getSourceReadStatus(source) === "unreadable");
  return latest ? { title: latest.source.title } : null;
}

export async function toGoalUploadRequest(goal: Goal): Promise<GoalUploadRequest | null> {
  if (!goal.researchUploadReason) {
    return null;
  }

  return {
    examDocument: getExamDocument(goal),
    goalId: goal.id,
    goalKind: goal.kind,
    language: goal.language,
    reason: goal.researchUploadReason,
    unreadableUpload: await findLatestUnreadableUpload(goal.id),
  };
}

export type ResearchUploadAnswerKey = { answerId: string; userId: string };

type ResearchUploadAccess = ResearchAccess & { pendingUploadAnswer?: ResearchUploadAnswerKey };

type ResearchUploadRefusal =
  | { status: "alreadyAnswered" }
  | { status: "noUploadRequest" }
  | { status: "unreadable" };

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

  return { request: await toGoalUploadRequest(owned.goal), status: "ready" };
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
}): Promise<ResearchUploadAccess | ResearchUploadRefusal> {
  const [access, session] = await Promise.all([
    getResearchAccess({ goalId, sourceIds }),
    getSession(),
  ]);

  if (access.status !== "ready" || access.sourceIds.length === 0 || !session) {
    return access;
  }

  const userId = session.user.id;

  const answered = await writeLearnerChange<
    Extract<ResearchUploadAccess, { status: "ready" }>,
    ResearchUploadRefusal
  >({ userId }, async (transaction) => {
    const goal = await transaction.goal.findFirst({
      select: { researchUploadReason: true },
      where: { id: goalId, userId },
    });

    if (!goal?.researchUploadReason) {
      return unchanged({ status: "noUploadRequest" } as const);
    }

    const sources = await transaction.source.findMany({
      select: { extractedText: true, id: true, readState: true },
      where: { id: { in: access.sourceIds } },
    });

    const statuses = new Map(sources.map((source) => [source.id, getSourceReadStatus(source)]));

    if (
      !access.sourceIds.some(
        (id) => statuses.get(id) === "readable" || statuses.get(id) === "reading",
      )
    ) {
      return unchanged({ status: "unreadable" } as const);
    }

    await linkGoalSources(transaction, {
      goalId,
      origin: "upload",
      sourceIds: access.sourceIds,
      userId,
    });

    const fresh = await transaction.goalSource.updateMany({
      data: { answeredAt: new Date() },
      where: { answeredAt: null, goalId, sourceId: { in: access.sourceIds } },
    });

    if (fresh.count === 0) {
      return unchanged({ status: "alreadyAnswered" } as const);
    }

    await transaction.goal.update({ data: { researchUploadReason: null }, where: { id: goalId } });

    if (![...statuses.values()].includes("reading")) {
      return {
        ...access,
        sourceIds: access.sourceIds.filter((id) => statuses.get(id) === "readable"),
      };
    }

    const answerId = randomUUID();

    await recordFollowUps({
      db: transaction,
      followUps: [
        {
          input: {
            answerId,
            goalId,
            reason: goal.researchUploadReason,
            sourceIds: access.sourceIds,
          },
          kind: "answerResearchUpload",
        },
      ],
      userId,
    });

    return { ...access, pendingUploadAnswer: { answerId, userId } };
  });

  if (answered.status === "ready") {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }

  return answered;
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
