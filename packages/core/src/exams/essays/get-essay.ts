import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { countGradesLeft, loadEssayDrafts } from "./_utils/essay-drafts";
import { findOwnedEssay } from "./_utils/owned-essay";
import { type EssayView } from "./essay-contract";
import { getEssayRubric } from "./essay-rubric";

export type EssayViewResult =
  | { essay: EssayView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** A writing block of the learner's session: the prompt, its rubric and the drafts so far. */
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
  // The request's own instant, read after its headers, so a prerender never samples the clock.
  const { currentInstant } = await getRequestProgressDateContext();

  const [drafts, gradesLeft] = await Promise.all([
    loadEssayDrafts({ itemId: item.id, sessionId, userId }),
    countGradesLeft({
      localDate: getDateInTimeZone({ date: currentInstant, timeZone: zone }),
      userId,
    }),
  ]);

  return {
    essay: {
      blockId,
      context: content.context,
      drafts,
      gradesLeft,
      question: content.question,
      rubric: getEssayRubric({ blueprint, criteria: content.rubric }).kind,
      sessionId,
      status: block.status,
    },
    status: "ready",
  };
}
