import { type Task } from "@/lib/types";
import { type Reasoning } from "@zoonk/ai/provider-options";
import { type WritingEvidence, gradeWritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import {
  applyWritingArithmetic,
  buildWritingFeedback,
} from "@zoonk/core/exams/essays/writing-feedback";
import {
  countWritingLines,
  WRITING_LINE_WIDTHS,
} from "@zoonk/core/exams/essays/writing-lines";
import { getWritingGraderSheet } from "@zoonk/core/exams/essays/writing-sheet";
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
  basis,
  context,
  keyPoints,
  language,
  model,
  numeric,
  question,
  reasoning,
  text,
  useFallback,
}: GradeWritingInput & { model: string; reasoning?: Reasoning; useFallback?: boolean }) {
  const { estimatedLines, ignoredFrom } = countWritingLines({
    ...WRITING_LINE_WIDTHS,
    limit: basis.lines,
    text,
  });

  const eligible = ignoredFrom === null ? text : text.slice(0, ignoredFrom);

  const graded = await gradeWritingEvidence({
    ...getWritingGraderSheet(basis),
    context,
    keyPoints,
    language,
    model,
    question,
    reasoning,
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
    basis,
    context,
    eligible,
    estimatedLines,
    evidence,
    feedback,
    numeric,
  });

  return { ...graded, data: { estimatedLines, evidence, result } };
}

export const gradeEssayTask = {
  description:
    "Grade written answers as evidence (one award per row of the scoring sheet, limits, counted parts, exact-quoted language errors) on CGU, Enem, OAB and no-scale sheets; code-scored for false deductions, false zeroes, credit and pass-side decisions",
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
} satisfies Task<GradeWritingInput, GradeWritingOutput, GradeWritingExpected>;
