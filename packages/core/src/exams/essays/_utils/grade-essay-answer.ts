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

/** A draft at 60% of the rubric's points reads as a good answer, like ENEM's 600. */
const GOOD_SHARE = 0.6;

function joinPrompt({ context, question }: { context: string | null; question: string }) {
  return context ? `${context}\n\n${question}` : question;
}

/**
 * Grades an essay with the official rubric (ENEM's five competencies, OAB's brief section by
 * section, or the item's criteria): every criterion with a comment on the learner's own words, an
 * estimated range and one next step. A model call: it runs only from a learner's POST.
 */
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

/** Locks the writing block against its settlement and says whether it's no longer being written. */
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

/**
 * Records a graded essay as learning, written in a session's writing block (`studySessionId`,
 * while `activeBlockId` is still being written) or in a full mock's written part (`mockExamId`):
 * good from 60% of the rubric's points. It's recorded once under its claimed `attemptId`, which
 * the same transaction releases (`claimEssayGrades`).
 */
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
