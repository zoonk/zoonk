import "server-only";
import { type Attempt, prisma } from "@zoonk/db";
import { findSavedAttempt } from "../../learner/_utils/answer-once";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getBlockElapsedMs } from "../../sessions/_utils/block-timing";
import { readBlockPayload } from "../../sessions/block-payload";
import { startStudyBlock } from "../../sessions/start-study-block";
import { claimEssayGrades, releaseEssayGradeClaims } from "./_utils/essay-grade-claims";
import { gradeWriting, recordEssayGrade } from "./_utils/grade-essay-answer";
import { findOwnedEssay } from "./_utils/owned-essay";
import { getWritingAttemptId } from "./_utils/writing-attempt-id";
import { type EssaySubmissionInput } from "./essay-contract";
import { getWritingAdmissionId } from "./writing-admission";
import {
  type WritingConditions,
  type WritingResult,
  writtenAnswerSchema,
} from "./writing-contract";

export type SubmitEssayResult =
  | { grade: WritingResult; status: "writingGraded" }
  | { status: "blockNotActive" | "notFound" | "unauthorized" };

function replaySaved(saved: Pick<Attempt, "answer">): SubmitEssayResult {
  const grade = writtenAnswerSchema.safeParse(saved.answer).data?.grade;
  return grade ? { grade, status: "writingGraded" } : { status: "notFound" };
}

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

  const { owned } = found;
  const { block, goal, item, sessionId, userId } = owned;
  const admissionId = input.admissionId;

  if (!admissionId) {
    return { status: "blockNotActive" };
  }

  const attemptId = getWritingAttemptId({ admissionId, itemId: item.id });
  const saved = await findSavedAttempt({ attemptId, userId });

  if (saved) {
    return saved.studySessionId === sessionId ? replaySaved(saved) : { status: "notFound" };
  }

  if (readBlockPayload(block).writing?.admissionId !== admissionId) {
    return { status: "blockNotActive" };
  }

  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  const started =
    block.status === "pending"
      ? await startStudyBlock({ blockId: block.id, input: { timeZone }, sessionId })
      : null;

  const rewrite = admissionId !== getWritingAdmissionId({ blockId: block.id });
  const completedRewrite = rewrite && block.status === "completed";

  if (!completedRewrite && block.status !== "active" && started?.status !== "ready") {
    return { status: "blockNotActive" };
  }

  const [claim] = await claimEssayGrades({ admissionId, attemptIds: [attemptId], userId });

  if (claim?.status === "saved") {
    return replaySaved(claim.saved);
  }

  if (claim?.status !== "claimed") {
    return { status: "notFound" };
  }

  try {
    return await gradeAdmittedEssay({
      conditions: {
        admissionId,
        estimatedLines: 0,
        origin: "block",
        timed: false,
        version: rewrite ? "rewrite" : "firstDraft",
      },
      input,
      owned,
      timeZone,
    });
  } finally {
    await releaseEssayGradeClaims({ attemptIds: [attemptId], userId });
  }
}

async function gradeAdmittedEssay({
  conditions,
  input,
  owned,
  timeZone,
}: {
  conditions: WritingConditions;
  input: EssaySubmissionInput;
  owned: Extract<Awaited<ReturnType<typeof findOwnedEssay>>, { status: "ready" }>["owned"];
  timeZone: string;
}): Promise<SubmitEssayResult> {
  const { block, content, item, sessionId, userId } = owned;

  const earlier = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { answer: true },
    take: 3,
    where: { itemId: item.id, studySessionId: sessionId, userId },
  });

  const previousNextSteps = earlier.flatMap(
    ({ answer }) => writtenAnswerSchema.safeParse(answer).data?.grade.nextStep?.criterionId ?? [],
  );

  const text = input.text;

  const grade = await gradeWriting({
    analytics: { contentScope: "personal", distinctId: userId, goalId: owned.goal?.id },
    content,
    language: item.language,
    previousNextSteps,
    text,
  });

  const recorded = await recordEssayGrade({
    activeBlockId: block.id,
    conditions,
    durationMs: Math.min(input.durationMs, getBlockElapsedMs({ block, now: new Date() })),
    grade,
    item,
    studySessionId: sessionId,
    text,
    timeZone,
    userId,
  });

  if (recorded.status === "refused") {
    return { status: recorded.refusal };
  }

  return recorded.status === "saved"
    ? replaySaved(recorded.saved)
    : { grade, status: "writingGraded" };
}
