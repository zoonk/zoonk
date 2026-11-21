import "server-only";
import { type Goal, type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { type BlockPayload, readBlockPayload } from "../../sessions/block-payload";
import { getStoredBlockWait } from "../../sessions/block-wait";
import { startStudyBlock } from "../../sessions/start-study-block";
import { getSession } from "../../users/get-session";
import { listPracticeWritingTasks } from "./_utils/practice-writing-tasks";
import {
  InvalidWritingRewriteError,
  admitWriting,
  readWritingExtraLimit,
} from "./writing-admission";
import { type WritingTaskSummary } from "./writing-contract";
import { findWritingPrompts } from "./writing-supply";

async function describeRefusedTask({
  block,
  examBlueprintId,
  tx,
  userId,
  writing,
}: {
  block: { estimatedMinutes: number | null };
  examBlueprintId: string | null;
  tx: TransactionClient;
  userId: string;
  writing: { taskKey: string; unit: WritingTaskSummary["unit"] };
}): Promise<WritingTaskSummary | undefined> {
  if (!examBlueprintId || !block.estimatedMinutes) {
    return undefined;
  }

  const blueprint = await tx.examBlueprint.findFirst({
    where: { OR: [{ ownerId: userId }, { visibility: "public" }], id: examBlueprintId },
  });

  const task =
    blueprint &&
    listPracticeWritingTasks({
      classTest: Boolean(blueprint.ownerId),
      structure: readBlueprintContent(blueprint).structure,
    }).find(({ key }) => key === writing.taskKey);

  return task
    ? {
        description: task.description,
        lines: task.lines,
        minutes: block.estimatedMinutes,
        points: task.points,
        taskKey: task.key,
        unit: writing.unit,
      }
    : undefined;
}

async function findFirstWriting({
  block,
  goal,
  localDate,
  payload,
  tx,
  userId,
  writing,
}: {
  block: StudySessionBlock;
  goal: Goal;
  localDate: Date;
  payload: BlockPayload;
  tx: TransactionClient;
  userId: string;
  writing: NonNullable<BlockPayload["writing"]>;
}) {
  const request = {
    count: 1,
    skillId: writing.unit === "drill" ? payload.skillIds[0] : undefined,
    taskKey: writing.taskKey,
    unit: writing.unit,
  };

  const found = await findWritingPrompts({
    goal,
    goalId: goal.id,
    requests: [request],
    tx,
    userId,
  });

  if (found.status === "ready") {
    return admitWriting({
      extra: payload.extra,
      itemIds: found.itemIds,
      localDate,
      owner: { block },
      tx,
      userId,
    });
  }

  const refusal = payload.extra ? await readWritingExtraLimit({ localDate, tx, userId }) : null;

  return (
    refusal ?? { input: { ...request, goalId: goal.id, userId }, status: "needsPrompt" as const }
  );
}

export async function startWriting({
  blockId,
  previousAttemptId,
}: {
  blockId: string;
  previousAttemptId?: string;
}) {
  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(blockId)) {
    return { status: "notFound" as const };
  }

  const userId = actor.user.id;

  const { data: started, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { userId });
      await lockUsageForViewer({ transaction: tx, userId });

      const block = await tx.studySessionBlock.findFirst({
        include: { session: { select: { goalId: true } } },
        where: { id: blockId, kind: "produce", session: { userId } },
      });

      if (!block || !block.session.goalId) {
        return { status: "notFound" as const };
      }

      const payload = readBlockPayload(block);
      const { writing } = payload;

      if (!writing) {
        return { status: "notFound" as const };
      }

      const earlier =
        writing.unit === "drill"
          ? await tx.studySessionBlock.findUnique({
              where: {
                sessionPosition: { position: block.position - 1, sessionId: block.sessionId },
              },
            })
          : null;

      if (
        block.status === "skipped" ||
        getStoredBlockWait({ block, blocks: earlier ? [earlier] : [] })
      ) {
        return { status: "blockNotActive" as const };
      }

      if (!previousAttemptId && writing.admissionId) {
        return {
          admissionId: writing.admissionId,
          admitted: false,
          sessionId: block.sessionId,
          status: "ready" as const,
        };
      }

      const goal = await tx.goal.findUniqueOrThrow({ where: { id: block.session.goalId } });

      const localDate = getDateInTimeZone({
        date: new Date(),
        timeZone: getAnswerTimeZone({ goal }),
      });

      const admission = previousAttemptId
        ? await admitWriting({
            extra: true,
            itemIds: payload.itemIds,
            localDate,
            owner: { block, previousAttemptId },
            tx,
            userId,
          })
        : await findFirstWriting({ block, goal, localDate, payload, tx, userId, writing });

      if (!previousAttemptId && admission.status === "limitReached") {
        const task = await describeRefusedTask({
          block,
          examBlueprintId: goal.examBlueprintId,
          tx,
          userId,
          writing,
        });

        return { ...admission, ...(task && { task }) };
      }

      return admission.status === "ready"
        ? {
            ...admission,
            admitted: admission.admissionId !== writing.admissionId,
            sessionId: block.sessionId,
          }
        : admission;
    }),
  );

  if (error instanceof InvalidWritingRewriteError) {
    return { status: "invalidRewrite" as const };
  }

  if (error) {
    throw error;
  }

  if (started.status !== "ready") {
    return started;
  }

  if (started.admitted) {
    revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  }

  const opened = await startStudyBlock({ blockId, input: {}, sessionId: started.sessionId });

  if (opened.status !== "ready" && opened.status !== "blockFinished") {
    return { status: "blockNotActive" as const };
  }

  return { admissionId: started.admissionId, status: "ready" as const };
}
