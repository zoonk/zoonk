import { type WritingArithmetic } from "../writing-rubric-policy";

type PassedEvaluation = {
  corpus: string;
  model: string;
  promptRevision: string;
  arithmetic: WritingArithmetic;
};

export const passedWritingEvaluations: Readonly<Record<string, PassedEvaluation>> = {};
