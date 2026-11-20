import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlockPayload } from "../../sessions/block-payload";
import { getStoredBlockWait } from "../../sessions/block-wait";
import { startStudyBlock } from "../../sessions/start-study-block";
import { getSession } from "../../users/get-session";
import {
  InvalidWritingRewriteError,
  admitWriting,
  readWritingExtraLimit,
} from "./writing-admission";
import { findWritingPrompts } from "./writing-supply";

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

        return allowed.status === "ready" ? { ...allowed, sessionId: block.sessionId } : allowed;
      }

      const refusal = extra ? await readWritingExtraLimit({ localDate, tx, userId }) : null;

      if (refusal) {
        return refusal;
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
        ? { ...admission, sessionId: block.sessionId }
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

  const opened = await startStudyBlock({ blockId, input: {}, sessionId: started.sessionId });

  if (opened.status !== "ready" && opened.status !== "blockFinished") {
    return { status: "blockNotActive" as const };
  }

  return { admissionId: started.admissionId, status: "ready" as const };
}
