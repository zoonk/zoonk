import "server-only";
import {
  type ExamBlueprint,
  type Goal,
  type StudySessionBlock,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
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
import { indexWritingTasks } from "./_utils/writing-task-positions";
import {
  InvalidWritingRewriteError,
  admitWriting,
  readWritingExtraLimit,
} from "./writing-admission";
import { findWritingPrompts } from "./writing-supply";

function findCurrentTask({
  blueprint,
  taskKey,
  userId,
}: {
  blueprint: ExamBlueprint | null;
  taskKey: string;
  userId: string;
}) {
  if (!blueprint || (blueprint.ownerId !== userId && blueprint.visibility !== "public")) {
    return;
  }

  const tasks = listPracticeWritingTasks({
    classTest: Boolean(blueprint.ownerId),
    structure: readBlueprintContent(blueprint).structure,
  });

  const task = tasks.find(({ key }) => key === taskKey);

  return task && { ...task, ...indexWritingTasks(tasks).get(taskKey) };
}

function summarizeTask({
  estimatedMinutes,
  task,
  unit,
}: {
  estimatedMinutes: number | null;
  task: ReturnType<typeof findCurrentTask>;
  unit: NonNullable<BlockPayload["writing"]>["unit"];
}) {
  return task && estimatedMinutes
    ? {
        description: task.description,
        lines: task.lines,
        minutes: estimatedMinutes,
        ...(task.number && { number: task.number, total: task.total }),
        points: task.points,
        taskKey: task.key,
        unit,
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
  goal: Goal & { examBlueprint: ExamBlueprint | null };
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
        (block.status === "skipped" && writing.admissionId) ||
        getStoredBlockWait({ block, blocks: earlier ? [earlier] : [] })
      ) {
        return { status: "blockNotActive" as const, unit: writing.unit };
      }

      if (!previousAttemptId && writing.admissionId) {
        return {
          admissionId: writing.admissionId,
          admitted: false,
          sessionId: block.sessionId,
          status: "ready" as const,
          unit: writing.unit,
        };
      }

      const goal = await tx.goal.findUniqueOrThrow({
        include: { examBlueprint: true },
        where: { id: block.session.goalId },
      });

      const task = previousAttemptId
        ? undefined
        : findCurrentTask({ blueprint: goal.examBlueprint, taskKey: writing.taskKey, userId });

      if (!previousAttemptId && !task) {
        return { status: "taskRemoved" as const, unit: writing.unit };
      }

      if (block.status === "skipped") {
        return { status: "blockNotActive" as const, unit: writing.unit };
      }

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

      if (admission.status === "limitReached") {
        const summary = summarizeTask({
          estimatedMinutes: block.estimatedMinutes,
          task,
          unit: writing.unit,
        });

        return { ...admission, ...(summary && { task: summary }), unit: writing.unit };
      }

      return admission.status === "ready"
        ? {
            ...admission,
            admitted: admission.admissionId !== writing.admissionId,
            sessionId: block.sessionId,
            unit: writing.unit,
          }
        : admission;
    }),
  );

  if (error instanceof InvalidWritingRewriteError) {
    return { status: "invalidRewrite" as const, unit: error.unit };
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
    return { status: "blockNotActive" as const, unit: started.unit };
  }

  return { admissionId: started.admissionId, status: "ready" as const };
}
