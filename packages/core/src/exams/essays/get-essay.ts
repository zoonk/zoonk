import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { loadWritingTask } from "../../sessions/_utils/writing-block-tasks";
import { readBlockPayload } from "../../sessions/block-payload";
import { loadEssayDrafts } from "./_utils/essay-drafts";
import { findOwnedEssay } from "./_utils/owned-essay";
import { getWritingAttemptId } from "./_utils/writing-attempt-id";
import { type EssayView } from "./essay-contract";
import { countWritingExtrasLeft } from "./writing-admission";
import { readWritingPrompt } from "./writing-contract";

export type EssayViewResult =
  | { essay: EssayView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export async function getEssay({
  blockId,
  timeZone,
}: {
  blockId: string;
  timeZone?: string;
}): Promise<EssayViewResult> {
  const found = await findOwnedEssay(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { block, content, goal, item, sessionId, userId } = found.owned;
  const zone = getAnswerTimeZone({ goal, timeZone });
  const { currentInstant } = await getRequestProgressDateContext();

  const { writing, writingPacing } = readBlockPayload(block);
  const admissionId = writing?.admissionId;
  const localDate = getDateInTimeZone({ date: currentInstant, timeZone: zone });

  const [drafts, gradesLeft, submitted, writingTask] = await Promise.all([
    loadEssayDrafts({ itemId: item.id, sessionId, userId }),
    countWritingExtrasLeft({ localDate, tx: prisma, userId }),
    admissionId
      ? prisma.attempt.findFirst({
          select: { id: true },
          where: { id: getWritingAttemptId({ admissionId, itemId: item.id }), userId },
        })
      : null,
    writing && loadWritingTask({ blueprintId: goal?.examBlueprintId, taskKey: writing.taskKey }),
  ]);

  return {
    essay: {
      ...(admissionId && { admissionId }),
      blockId,
      context: content.context,
      draft: admissionId && writing?.draft && !submitted ? { ...writing.draft, admissionId } : null,
      drafts,
      gradesLeft,
      pacing: { minutes: block.estimatedMinutes ?? 1, source: writingPacing ?? "practice" },
      question: content.question,
      sessionId,
      status: block.status,
      writing: readWritingPrompt(content.writing),
      ...(writingTask && { writingTask }),
    },
    status: "ready",
  };
}
