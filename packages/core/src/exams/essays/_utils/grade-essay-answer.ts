import "server-only";
import { gradeEssay } from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { type ExamBlueprint, type Item, type TransactionClient } from "@zoonk/db";
import {
  type RecordedOutcome,
  type RefusedOutcome,
  recordAnswerOnce,
} from "../../../learner/_utils/answer-once";
import { type EssayGradeView } from "../essay-contract";
import { getEssayRubric } from "../essay-rubric";
import { type EssayContent } from "./essay-content";
import { endEssayGradeClaim } from "./essay-grade-claims";

const GOOD_SHARE = 0.6;

function joinPrompt({ context, question }: { context: string | null; question: string }) {
  return context ? `${context}\n\n${question}` : question;
}

export async function gradeEssayText({
  blueprint,
  content,
  goalId,
  language,
  text,
  userId,
}: {
  blueprint: Pick<ExamBlueprint, "identityKey" | "name"> | null;
  content: EssayContent;
  goalId: string | undefined;
  language: string;
  text: string;
  userId: string;
}): Promise<EssayGradeView> {
  const { data } = await gradeEssay({
    analytics: { contentScope: "personal", distinctId: userId, goalId },
    essay: text,
    keyPoints: content.keyPoints,
    language,
    prompt: joinPrompt(content),
    rubric: getEssayRubric({ blueprint, criteria: content.rubric }),
  });

  return data;
}

async function refuseClosedBlock(
  transaction: TransactionClient,
  blockId: string,
): Promise<"blockNotActive" | null> {
  const active = await transaction.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "study_session_blocks"
    WHERE "id" = ${blockId}::uuid AND "status" = 'active'
    FOR SHARE
  `;

  return active.length > 0 ? null : "blockNotActive";
}

/** Records once per claimed `attemptId` and releases the claim in the same transaction. */
export function recordEssayGrade({
  activeBlockId,
  attemptId,
  durationMs,
  grade,
  item,
  mockExamId,
  studySessionId,
  text,
  timeZone,
  userId,
}: {
  activeBlockId?: string;
  attemptId: string;
  durationMs: number;
  grade: EssayGradeView;
  item: Item;
  mockExamId?: string;
  studySessionId: string | null;
  text: string;
  timeZone: string;
  userId: string;
}): Promise<RecordedOutcome | RefusedOutcome<"blockNotActive">> {
  const share = grade.total.maxScore > 0 ? grade.total.score / grade.total.maxScore : 0;

  return recordAnswerOnce({
    answer: {
      answer: { grade, text },
      attemptId,
      graded: { durationMs, isCorrect: share >= GOOD_SHARE, score: share },
      itemId: item.id,
      language: item.language,
      mockExamId,
      purpose: "learning",
      skillId: item.skillId,
      studySessionId,
      timeZone,
      userId,
    },
    refuse: (transaction: TransactionClient) =>
      activeBlockId ? refuseClosedBlock(transaction, activeBlockId) : Promise.resolve(null),
    withAnswer: (transaction) => endEssayGradeClaim(transaction, { attemptId, userId }),
  });
}
