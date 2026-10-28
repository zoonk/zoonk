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

function replaySaved(saved: Pick<Attempt, "answer">): SubmitEssayResult {
  const grade = essayAnswerSchema.safeParse(saved.answer).data?.grade;
  return grade ? { grade, status: "graded" } : { status: "notFound" };
}

/** Reusing an `attemptId` replays its saved grade, including concurrent submissions. */
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

    return recorded.status === "saved" ? replaySaved(recorded.saved) : { grade, status: "graded" };
  } finally {
    await releaseEssayGradeClaims({ attemptIds: [attemptId], userId });
  }
}
