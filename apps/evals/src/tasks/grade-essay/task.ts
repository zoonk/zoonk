import { type Task } from "@/lib/types";
import { type Reasoning } from "@zoonk/ai/provider-options";
import { type WritingEvidence, gradeWritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import {
  applyWritingArithmetic,
  buildWritingFeedback,
} from "@zoonk/core/exams/essays/writing-feedback";
import {
  WRITING_MAX_CHARACTERS_PER_LINE,
  countWritingLines,
} from "@zoonk/core/exams/essays/writing-lines";
import { type GradeWritingExpected, type GradeWritingInput } from "./cases/shared";
import { scoreWritingGrade } from "./scorer";
import { TEST_CASES } from "./test-cases";

export type GradeWritingOutput = {
  estimatedLines: number;
  evidence: Omit<WritingEvidence, "nextStep"> & {
    nextStep: (Omit<NonNullable<WritingEvidence["nextStep"]>, "title"> & { title?: string }) | null;
  };
  result: WritingResult;
};

/** Grades as production does, then applies the arithmetic a numeric enablement would pin. */
async function generate({
  arithmetic,
  basis,
  context,
  keyPoints,
  language,
  model,
  question,
  reasoning,
  text,
  useFallback,
}: GradeWritingInput & { model: string; reasoning?: Reasoning; useFallback?: boolean }) {
  const { estimatedLines, ignoredFrom } = countWritingLines({
    charactersPerLine: basis.charactersPerLine,
    limit: basis.lines,
    maxCharactersPerLine: WRITING_MAX_CHARACTERS_PER_LINE,
    text,
  });

  const eligible = ignoredFrom === null ? text : text.slice(0, ignoredFrom);

  const graded = await gradeWritingEvidence({
    aspects: basis.aspects,
    context,
    keyPoints,
    language,
    model,
    question,
    reasoning,
    scoringBasis: {
      ...basis.grading,
      criteria: basis.grading.criteria.length > 0 ? basis.grading.criteria : basis.criteria,
      lines: basis.lines,
      points: basis.points,
    },
    text: eligible,
    useFallback,
  });

  const evidence = graded.data;

  const feedback = buildWritingFeedback({
    basis,
    eligible,
    evidence,
    ignoredFrom,
    previousNextSteps: [],
  });

  const result = applyWritingArithmetic({
    arithmetic,
    basis,
    context,
    eligible,
    estimatedLines,
    evidence,
    feedback,
  });

  return { ...graded, data: { estimatedLines, evidence, result } };
}

export const gradeEssayTask: Task<GradeWritingInput, GradeWritingOutput, GradeWritingExpected> = {
  description:
    "Grade written answers as evidence (aspects, criterion levels, exact-quoted language errors) on CGU, Enem, OAB and no-scale bases; code-scored for false deductions, false zeroes, credit and pass-side decisions",
  generate,
  id: "grade-essay",
  name: "Grade essay",
  priorities: {
    distribution: "private",
    first: "quality",
    reads: "A learner reads their grade and feedback",
    reason:
      "A wrong grade misleads the learner about where they stand; it must also come back in seconds",
    waits: "A learner waits on the grade",
  },
  score: scoreWritingGrade,
  testCases: TEST_CASES,
};
