import { createChoiceEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type MistakeCauseParams,
  type MistakeCauseSchema,
  classifyMistakeCause,
  mistakeCauseClassifier,
} from "@zoonk/ai/tasks/v2/mistakes/cause";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type MistakeCauseExpected, scoreMistakeCause } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const mistakeCauseTask: Task<MistakeCauseParams, MistakeCauseSchema, MistakeCauseExpected> =
  {
    description: "Names the cause of an ambiguous mistake: content gap, misread or trap",
    evaluate: createChoiceEvaluation({
      classifier: mistakeCauseClassifier,
      toOutput: (cause) => ({ cause }),
    }),
    generate: classifyMistakeCause,
    id: "mistake-cause",
    name: "Mistake Cause",
    score: scoreMistakeCause,
    testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
  };
