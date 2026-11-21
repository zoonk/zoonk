import { createChoiceEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type UnderstandGoalParams,
  goalRouteClassifier,
  understandGoal,
} from "@zoonk/ai/tasks/goals/understand-goal";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { formatReadingMaterial } from "@zoonk/core/view-models/onboarding/reading-material";
import { MATERIAL_TEST_CASES, type UnderstandGoalCaseInput } from "./material-cases";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type UnderstandGoalExpected, scoreUnderstandGoal } from "./scorer";
import { TEST_CASES } from "./test-cases";

type CaseParams = Omit<UnderstandGoalParams, "dailyMinutesLimits" | "material"> &
  UnderstandGoalCaseInput;

/** The material as the run reads it: from the learner's files, within the same budget. */
function readCaseMaterial({
  material,
  ...params
}: CaseParams): Omit<UnderstandGoalParams, "dailyMinutesLimits"> {
  if (!material) {
    return params;
  }

  const sources = material.sources.map((source, index) => ({
    contentHash: "",
    id: `source-${index + 1}`,
    mimeType: source.mimeType ?? "text/plain",
    text: source.text,
    title: source.title,
  }));

  const overview = formatReadingMaterial({ sources });
  return { ...params, material: overview ? { intent: material.intent, overview } : null };
}

const evaluateRoute = createChoiceEvaluation({
  classifier: goalRouteClassifier,
  toOutput: (route) => ({ route }),
});

export const understandGoalTask: Task<CaseParams, unknown, UnderstandGoalExpected> = {
  description:
    "Read a goal typed in the learner's own words, with any material they attached: its route and every onboarding answer it already gives",
  evaluate: (params) => evaluateRoute({ ...readCaseMaterial(params), model: params.model }),
  generate: (params) =>
    understandGoal({
      ...readCaseMaterial(params),
      dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
    }),
  id: "understand-goal",
  name: "Understand goal",
  score: scoreUnderstandGoal,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES, ...MATERIAL_TEST_CASES],
};
