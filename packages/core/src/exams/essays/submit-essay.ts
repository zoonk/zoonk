import { randomUUID } from "node:crypto";
import "server-only";
import { type Attempt, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findSavedAttempt, getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getBlockElapsedMs } from "../../sessions/_utils/block-timing";
import { readBlockPayload } from "../../sessions/block-payload";
import { startStudyBlock } from "../../sessions/start-study-block";
import {
  type EssayGradeClaim,
  claimEssayGrades,
  releaseEssayGradeClaims,
} from "./_utils/essay-grade-claims";
import { gradeEssayText, gradeWriting, recordEssayGrade } from "./_utils/grade-essay-answer";
import { findOwnedEssay } from "./_utils/owned-essay";
import {
  type EssayGradeView,
  type EssaySubmissionInput,
  essayAnswerSchema,
} from "./essay-contract";
import { getWritingAdmissionId, getWritingAttemptId } from "./writing-admission";
import {
  type WritingConditions,
  type WritingResult,
  writtenAnswerSchema,
} from "./writing-contract";

export type SubmitEssayResult =
  | { grade: EssayGradeView; status: "graded" }
  | { grade: WritingResult; status: "writingGraded" }
  | { status: "blockNotActive" | "limitReached" | "notFound" | "signUpRequired" | "unauthorized" };

function replaySaved(saved: Pick<Attempt, "answer">): SubmitEssayResult {
  const writing = writtenAnswerSchema.safeParse(saved.answer).data?.grade;

  if (writing) {
    return { grade: writing, status: "writingGraded" };
  }

  const grade = essayAnswerSchema.safeParse(saved.answer).data?.grade;
  return grade ? { grade, status: "graded" } : { status: "notFound" };
}

function settleUnclaimed(claim: EssayGradeClaim | undefined): SubmitEssayResult {
  if (claim?.status === "saved") {
    return replaySaved(claim.saved);
  }

  return { status: claim?.status === "signUpRequired" ? "signUpRequired" : "limitReached" };
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

  const { block, blueprint, content, goal, item, sessionId, userId } = found.owned;

  if (content.writing) {
    return submitAdmittedEssay({ input, owned: found.owned });
  }

  const attemptId = input.attemptId
    ? getAnswerAttemptId({ key: input.attemptId, questionId: blockId, userId })
    : randomUUID();

  const saved = await findSavedAttempt({ attemptId, userId });

  if (saved) {
    return replaySaved(saved);
  }

  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const localDate = getDateInTimeZone({ date: new Date(), timeZone });

  // A written essay is graded even after its day ended, so the send takes on a block from any day.
  const started =
    block.status === "pending"
      ? await startStudyBlock({ blockId, input: { timeZone: input.timeZone }, sessionId })
      : null;

  if (block.status !== "active" && started?.status !== "ready") {
    return { status: "blockNotActive" };
  }

  const [claim] = await claimEssayGrades({ attemptIds: [attemptId], localDate, userId });

  if (claim?.status !== "claimed") {
    return settleUnclaimed(claim);
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

async function submitAdmittedEssay({
  input,
  owned,
}: {
  input: EssaySubmissionInput;
  owned: Extract<Awaited<ReturnType<typeof findOwnedEssay>>, { status: "ready" }>["owned"];
}): Promise<SubmitEssayResult> {
  const { block, goal, item, sessionId, userId } = owned;
  const admissionId = input.admissionId;

  if (!admissionId) {
    return { status: "blockNotActive" };
  }

  const receipt = await prisma.writingAdmission.findFirst({
    where: { id: admissionId, itemIds: { has: item.id }, userId },
  });

  if (!receipt) {
    return { status: "notFound" };
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

  const [claim] = await claimEssayGrades({
    admissionId,
    attemptIds: [attemptId],
    localDate: receipt.localDate,
    userId,
  });

  if (claim?.status === "saved") {
    return replaySaved(claim.saved);
  }

  if (claim?.status !== "claimed") {
    return { status: "blockNotActive" };
  }

  try {
    return await gradeAdmittedEssay({
      attemptId,
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
  attemptId,
  conditions,
  input,
  owned,
  timeZone,
}: {
  attemptId: string;
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
    conditions,
    content,
    language: item.language,
    previousNextSteps,
    text,
  });

  const recorded = await recordEssayGrade({
    activeBlockId: block.id,
    attemptId,
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
