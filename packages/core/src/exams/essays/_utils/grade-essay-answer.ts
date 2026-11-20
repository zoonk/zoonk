import "server-only";
import { gradeEssay, gradeWritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type ExamBlueprint, type Item, type TransactionClient } from "@zoonk/db";
import { countWords } from "@zoonk/utils/string";
import {
  type RecordedOutcome,
  type RefusedOutcome,
  recordAnswerOnce,
} from "../../../learner/_utils/answer-once";
import { creditWrittenSkills } from "../../../learner/written-evidence";
import { type EssayGradeView } from "../essay-contract";
import { getEssayRubric } from "../essay-rubric";
import { type WritingConditions, type WritingResult } from "../writing-contract";
import { countWritingLines } from "../writing-lines";
import { getWritingArithmetic } from "../writing-rubric-policy";
import { type EssayContent, readEssayContent } from "./essay-content";
import { endEssayGradeClaim } from "./essay-grade-claims";
import { getWritingAttemptId } from "./writing-attempt-id";
import { applyWritingArithmetic, buildWritingFeedback } from "./writing-feedback";

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
  if (content.writing) {
    throw new Error("An admitted writing item requires its own grading snapshot.");
  }

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

export async function gradeWriting({
  analytics,
  conditions: _conditions,
  content,
  language,
  previousNextSteps,
  text,
}: {
  analytics?: Parameters<typeof gradeWritingEvidence>[0]["analytics"];
  conditions: WritingConditions;
  content: EssayContent;
  language: string;
  previousNextSteps: readonly string[];
  text: string;
}): Promise<WritingResult> {
  const basis = content.writing;

  if (!basis) {
    throw new Error("The writing item has no scoring basis.");
  }

  const { estimatedLines, ignoredFrom } = countWritingLines({
    charactersPerLine: basis.charactersPerLine,
    limit: basis.lines,
    text,
  });

  const eligible = ignoredFrom === null ? text : text.slice(0, ignoredFrom);

  if (countWords(eligible) < basis.minimumWords || eligible.trim().length === 0) {
    const [criterion] = basis.criteria;

    return {
      criteria: basis.criteria.map(({ id, name }) => ({
        comment: "",
        id,
        level: "missing",
        name,
        quote: null,
      })),
      errors: [],
      ignoredFrom,
      kind: "levels",
      nextStep: criterion
        ? {
            criterionId: criterion.id,
            example: null,
            quote: null,
            text: "Expand your answer so there is enough writing to assess.",
          }
        : null,
      progress: null,
    };
  }

  const { data: evidence, provenance } = await gradeWritingEvidence({
    analytics,
    aspects: basis.aspects,
    context: content.context,
    keyPoints: content.keyPoints,
    language,
    question: content.question,
    scoringBasis: {
      ...basis.grading,
      criteria: basis.grading.criteria.length > 0 ? basis.grading.criteria : basis.criteria,
      lines: basis.lines,
      points: basis.points,
    },
    text: eligible,
  });

  const feedback = buildWritingFeedback({
    basis,
    eligible,
    evidence,
    ignoredFrom,
    previousNextSteps,
  });

  return applyWritingArithmetic({
    arithmetic: getWritingArithmetic(basis, provenance),
    basis,
    eligible,
    estimatedLines,
    evidence,
    feedback,
  });
}

type RecordGrade = {
  durationMs: number;
  item: Item;
  studySessionId: string | null;
  text: string;
  timeZone: string;
  userId: string;
} & { activeBlockId?: string; mockExamId?: string };

type AdmittedGrade = RecordGrade & {
  conditions: WritingConditions;
  grade: WritingResult;
  attemptId?: string;
};

async function confirmAdmission(
  tx: TransactionClient,
  { activeBlockId, conditions, item, mockExamId, studySessionId, userId }: AdmittedGrade,
) {
  const admission = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM writing_admissions
    WHERE id = ${conditions.admissionId}::uuid AND user_id = ${userId}::uuid
      AND ${item.id}::uuid = ANY(item_ids)
    FOR SHARE
  `;

  if (admission.length === 0) {
    return false;
  }

  if (conditions.origin === "mock" && mockExamId) {
    const finished = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM mock_exams
      WHERE id = ${mockExamId}::uuid AND user_id = ${userId}::uuid AND status = 'finished'
        AND conditions->>'writingAdmissionId' = ${conditions.admissionId}
      FOR SHARE
    `;

    return finished.length > 0;
  }

  if (conditions.origin === "block" && activeBlockId && studySessionId && !mockExamId) {
    const blocks = await tx.$queryRaw<{ id: string }[]>`
      SELECT block.id FROM study_session_blocks AS block
      INNER JOIN study_sessions AS session ON session.id = block.session_id
      WHERE block.id = ${activeBlockId}::uuid AND session.id = ${studySessionId}::uuid
        AND session.user_id = ${userId}::uuid AND block.status = 'active'
        AND block.kind = 'produce' AND block.payload->'writing'->>'admissionId' = ${conditions.admissionId}
        AND block.payload->'itemIds'->>0 = ${item.id}
      FOR SHARE OF block
    `;

    return blocks.length > 0;
  }

  return false;
}

function recordAdmittedGrade(input: AdmittedGrade) {
  const {
    conditions,
    durationMs,
    grade,
    item,
    mockExamId,
    studySessionId,
    text,
    timeZone,
    userId,
  } = input;

  const attemptId = getWritingAttemptId({ admissionId: conditions.admissionId, itemId: item.id });
  const basis = readEssayContent(item)?.writing;

  if (!basis || (grade.kind === "points" && !getWritingArithmetic(basis))) {
    throw new Error("The writing grade is incompatible with its scoring basis.");
  }

  const { estimatedLines } = countWritingLines({
    charactersPerLine: basis.charactersPerLine,
    limit: basis.lines,
    text,
  });

  const writtenConditions = { ...conditions, estimatedLines };

  const share =
    grade.kind === "points" ? (grade.total.low + grade.total.high) / 2 / grade.max : null;

  return recordAnswerOnce({
    answer: {
      answer: { conditions: writtenConditions, grade, text },
      attemptId,
      graded: { durationMs, isCorrect: share !== null && share >= GOOD_SHARE, score: share },
      itemId: item.id,
      language: item.language,
      mockExamId,
      purpose: "learning",
      studySessionId,
      timeZone,
      userId,
    },
    refuse: async (tx: TransactionClient) =>
      (await confirmAdmission(tx, input)) ? null : ("blockNotActive" as const),
    withAnswer: async (tx: TransactionClient) => {
      await creditWrittenSkills({ attemptId, conditions: writtenConditions, grade, item, tx });
      await endEssayGradeClaim(tx, { attemptId, userId });
    },
  });
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

export function recordEssayGrade(
  input: (RecordGrade & { attemptId: string; grade: EssayGradeView }) | AdmittedGrade,
): Promise<RecordedOutcome | RefusedOutcome<"blockNotActive">> {
  if ("conditions" in input) {
    return recordAdmittedGrade(input);
  }

  const {
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
  } = input;

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
