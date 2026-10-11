import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { startStudyBlock } from "../../sessions/start-study-block";
import { countGradesLeft } from "./_utils/essay-drafts";
import { gradeEssayText, recordEssayGrade } from "./_utils/grade-essay-answer";
import { findOwnedEssay } from "./_utils/owned-essay";
import { type EssayGradeView, type EssaySubmissionInput } from "./essay-contract";

export type SubmitEssayResult =
  | { grade: EssayGradeView; status: "graded" }
  | { status: "blockNotActive" | "limitReached" | "notFound" | "unauthorized" };

/**
 * Grades a draft of the block's essay with the official rubric (ENEM's five competencies, OAB's
 * brief section by section, or the item's criteria) and records it as learning: every criterion
 * with a comment on the learner's own words, an estimated range and one next step. Rewriting
 * grades a new draft; a day has a fair number of grades.
 */
export async function submitEssay({
  blockId,
  input,
}: {
  blockId: string;
  input: EssaySubmissionInput;
}): Promise<SubmitEssayResult> {
  const found = await findOwnedEssay(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { block, blueprint, content, goal, item, sessionDate, sessionId, userId } = found.owned;
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const localDate = getDateInTimeZone({ date: new Date(), timeZone });
  const isTodays = sessionDate.getTime() === localDate.getTime();

  // Sending a draft takes today's block on, as opening it from the session does (a writing page
  // opened from a link hasn't started it yet). Another day's block waits for its own session.
  const started =
    block.status === "pending" && isTodays
      ? await startStudyBlock({ blockId, input: { timeZone: input.timeZone }, sessionId })
      : null;

  if (block.status !== "active" && started?.status !== "ready") {
    return { status: "blockNotActive" };
  }

  if ((await countGradesLeft({ localDate, userId })) === 0) {
    return { status: "limitReached" };
  }

  const grade = await gradeEssayText({
    blueprint,
    content,
    goalId: goal?.id,
    language: goal?.language ?? item.language,
    text: input.text,
    userId,
  });

  await recordEssayGrade({
    durationMs: input.durationMs,
    grade,
    item,
    studySessionId: sessionId,
    text: input.text,
    timeZone,
    userId,
  });

  return { grade, status: "graded" };
}
