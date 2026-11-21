import { type writtenGradingSchema } from "../../../library/exams/written-grading";
import { type WritingArithmetic } from "../writing-rubric-policy";

type PassedEvaluation = {
  corpus: string;
  kind: Exclude<ReturnType<typeof writtenGradingSchema.parse>["kind"], "levels">;
  model: string;
  promptRevision: string;
  arithmetic: WritingArithmetic;
};

export const passedWritingEvaluations: Readonly<Record<string, PassedEvaluation>> = {};
