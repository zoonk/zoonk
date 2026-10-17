import "server-only";
import { randomUUID } from "node:crypto";
import { type Attempt } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findSavedAttempt, getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { startStudyBlock } from "../../sessions/start-study-block";
import { claimEssayGrades, releaseEssayGradeClaims } from "./_utils/essay-grade-claims";
import { gradeEssayText, recordEssayGrade } from "./_utils/grade-essay-answer";
import { findOwnedEssay } from "./_utils/owned-essay";
import {
  type EssayGradeView,
  type EssaySubmissionInput,
  essayAnswerSchema,
} from "./essay-contract";

export type SubmitEssayResult =
  | { grade: EssayGradeView; status: "graded" }
  | { status: "blockNotActive" | "limitReached" | "notFound" | "unauthorized" };

/** A draft saved already, with the grade it was saved with. */
function replaySaved(saved: Pick<Attempt, "answer">): SubmitEssayResult {
  const grade = essayAnswerSchema.safeParse(saved.answer).data?.grade;
  return grade ? { grade, status: "graded" } : { status: "notFound" };
}

/**
 * Grades a draft of the block's essay with the official rubric (ENEM's five competencies, OAB's
 * brief section by section, or the item's criteria) and records it as learning: every criterion
 * with a comment on the learner's own words, an estimated range and one next step. Rewriting
 * grades a new draft; a day has a fair number of grades. A draft sent with its `attemptId` is
 * graded and recorded once: sent again, even while the first is still being graded, it gets the
 * grade it was saved with. The grade is claimed before the model is called (`claimEssayGrades`),
 * so drafts sent at once never grade past the day's limit.
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

  const attemptId = input.attemptId
    ? getAnswerAttemptId({ key: input.attemptId, questionId: blockId, userId })
    : randomUUID();

  const saved = await findSavedAttempt({ attemptId, userId });

  if (saved) {
    return replaySaved(saved);
  }

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

  const [claim] = await claimEssayGrades({ attemptIds: [attemptId], localDate, userId });

  if (claim?.status === "saved") {
    return replaySaved(claim.saved);
  }

  if (claim?.status !== "claimed") {
    return { status: "limitReached" };
  }

  try {
    const grade = await gradeEssayText({
      blueprint,
      content,
      goalId: goal?.id,
      language: goal?.language ?? item.language,
      text: input.text,
      userId,
    });

    const recorded = await recordEssayGrade({
      activeBlockId: blockId,
      attemptId,
      durationMs: input.durationMs,
      grade,
      item,
      studySessionId: sessionId,
      text: input.text,
      timeZone,
      userId,
    });

    if (recorded.status === "refused") {
      return { status: recorded.refusal };
    }

    // A claim that outlived its time was taken over, and the other request recorded first.
    return recorded.status === "saved" ? replaySaved(recorded.saved) : { grade, status: "graded" };
  } finally {
    // A grade that wasn't recorded (the grader failed, or the block was settled meanwhile) frees
    // its claim, so the draft can be graded again; recording it ended the claim already.
    await releaseEssayGradeClaims({ attemptIds: [attemptId], userId });
  }
}
