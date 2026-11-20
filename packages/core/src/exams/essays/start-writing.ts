import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { readBlockPayload } from "../../sessions/block-payload";
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
        include: { session: { include: { blocks: { orderBy: { position: "asc" } }, goal: true } } },
        where: { id: blockId, kind: "produce", session: { userId } },
      });

      const goal = block?.session.goal;

      if (!block || !goal) {
        return { status: "notFound" as const };
      }

      const payload = readBlockPayload(block);
      const { writing } = payload;

      if (!writing) {
        return { status: "notFound" as const };
      }

      if (
        block.status === "skipped" ||
        getStoredBlockWait({ block, blocks: block.session.blocks })
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

      const localDate = getDateInTimeZone({
        date: new Date(),
        timeZone: getAnswerTimeZone({ goal }),
      });

      const extra = payload.extra || Boolean(previousAttemptId);
      const owner = { blockId, previousAttemptId };

      if (previousAttemptId) {
        const allowed = await admitWriting({
          extra,
          itemIds: payload.itemIds,
          localDate,
          owner,
          tx,
          userId,
        });

        return allowed.status === "ready"
          ? {
              ...allowed,
              admitted: allowed.admissionId !== writing.admissionId,
              sessionId: block.sessionId,
            }
          : allowed;
      }

      const refusal = extra ? await readWritingExtraLimit({ localDate, tx, userId }) : null;

      if (refusal) {
        const task = await describeRefusedTask({
          block,
          examBlueprintId: goal.examBlueprintId,
          tx,
          userId,
          writing,
        });

        return { ...refusal, ...(task && { task }) };
      }

      const request = {
        count: 1,
        skillId: writing.unit === "drill" ? payload.skillIds[0] : undefined,
        taskKey: writing.taskKey,
        unit: writing.unit,
      };

      const result = await findWritingPrompts({ goalId: goal.id, requests: [request], tx, userId });

      if (result.status === "missing") {
        return { input: { ...request, goalId: goal.id, userId }, status: "needsPrompt" as const };
      }

      const admission = await admitWriting({
        extra,
        itemIds: result.itemIds,
        localDate,
        owner,
        tx,
        userId,
      });

      return admission.status === "ready"
        ? { ...admission, admitted: true, sessionId: block.sessionId }
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
