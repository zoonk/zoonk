import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { readBlockPayload } from "../../sessions/block-payload";
import { loadEssayDrafts } from "./_utils/essay-drafts";
import { countGradesLeft } from "./_utils/essay-grade-claims";
import { findOwnedEssay } from "./_utils/owned-essay";
import { getWritingAttemptId } from "./_utils/writing-attempt-id";
import { type EssayView } from "./essay-contract";
import { getEssayRubric } from "./essay-rubric";
import { countWritingExtrasLeft } from "./writing-admission";
import { writingPromptSchema } from "./writing-contract";

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

  const { block, blueprint, content, goal, item, sessionId, userId } = found.owned;
  const zone = getAnswerTimeZone({ goal, timeZone });
  const { currentInstant } = await getRequestProgressDateContext();

  const { writing, writingPacing } = readBlockPayload(block);
  const admissionId = writing?.admissionId;
  const localDate = getDateInTimeZone({ date: currentInstant, timeZone: zone });

  const [drafts, writtenDrafts, gradesLeft, submitted] = await Promise.all([
    writing ? [] : loadEssayDrafts({ itemId: item.id, sessionId, userId }),
    writing
      ? loadEssayDrafts({ format: "writing", itemId: item.id, sessionId, userId })
      : undefined,
    writing
      ? countWritingExtrasLeft({ localDate, tx: prisma, userId })
      : countGradesLeft({ localDate, now: currentInstant, userId }),
    admissionId
      ? prisma.attempt.findFirst({
          select: { id: true },
          where: { id: getWritingAttemptId({ admissionId, itemId: item.id }), userId },
        })
      : null,
  ]);

  return {
    essay: {
      blockId,
      context: content.context,
      drafts,
      ...(writing && {
        draft:
          admissionId && writing.draft && !submitted ? { ...writing.draft, admissionId } : null,
        pacing: {
          minutes: block.estimatedMinutes ?? 1,
          source: writingPacing ?? ("practice" as const),
        },
        writing: writingPromptSchema.parse(content.writing),
        writtenDrafts,
      }),
      gradesLeft,
      question: content.question,
      rubric: getEssayRubric({ blueprint, criteria: content.rubric }).kind,
      sessionId,
      status: block.status,
    },
    status: "ready",
  };
}
