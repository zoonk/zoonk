import "server-only";
import { gradeEssay } from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { recordLearnerAnswer } from "../../learner/record-learner-answer";
import { startStudyBlock } from "../../sessions/start-study-block";
import { countGradesLeft } from "./_utils/essay-drafts";
import { findOwnedEssay } from "./_utils/owned-essay";
import { type EssayGradeView, type EssaySubmissionInput } from "./essay-contract";
import { getEssayRubric } from "./essay-rubric";

/** A draft at 60% of the rubric's points reads as a good answer, like ENEM's 600. */
const GOOD_SHARE = 0.6;

export type SubmitEssayResult =
  | { grade: EssayGradeView; status: "graded" }
  | { status: "blockNotActive" | "limitReached" | "notFound" | "unauthorized" };

function joinPrompt({ context, question }: { context: string | null; question: string }) {
  return context ? `${context}\n\n${question}` : question;
}

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

  const { data: grade } = await gradeEssay({
    analytics: { contentScope: "personal", distinctId: userId, goalId: goal?.id },
    essay: input.text,
    keyPoints: content.keyPoints,
    language: goal?.language ?? item.language,
    prompt: joinPrompt(content),
    rubric: getEssayRubric({ blueprint, criteria: content.rubric }),
  });

  const share = grade.total.maxScore > 0 ? grade.total.score / grade.total.maxScore : 0;

  await recordLearnerAnswer({
    answer: { grade, text: input.text },
    graded: { durationMs: input.durationMs, isCorrect: share >= GOOD_SHARE, score: share },
    itemId: item.id,
    language: item.language,
    purpose: "learning",
    skillId: item.skillId,
    studySessionId: sessionId,
    timeZone,
    userId,
  });

  return { grade, status: "graded" };
}
