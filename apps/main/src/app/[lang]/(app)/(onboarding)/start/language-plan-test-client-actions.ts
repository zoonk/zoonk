import { decidePlanChangeAction } from "@/app/[lang]/(app)/(learn)/plan/journey-actions";
import { type LanguagePlanTestActions } from "@zoonk/learn/language/level-test-flow";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import {
  answerLevelTestOutAction,
  finishLevelTestAttemptAction,
  finishLevelTestOutAction,
  getLevelTestAttemptAction,
  getLevelTestOutAction,
  startLevelTestAttemptAction,
  startLevelTestOutAction,
} from "../level-test/level-test-plan-actions";
import { answerLevelTestAction, startLevelTestBankAction } from "./language-level-test-actions";

export function getLanguagePlanTestActions(goalId: string): LanguagePlanTestActions {
  return {
    answer: (input) => answerLevelTestAction(goalId, input),
    finish: (attemptId) => finishLevelTestAttemptAction(goalId, attemptId),
    get: () => getLevelTestAttemptAction(goalId),
    prepare: () => startLevelTestBankAction(goalId),
    start: () => startLevelTestAttemptAction(goalId),
    testOut: {
      answer: (input) =>
        answerLevelTestOutAction(goalId, { ...input, timeZone: getLocalTimeZone() }),
      finish: (attemptId) => finishLevelTestOutAction(goalId, attemptId),
      get: (attemptId) => getLevelTestOutAction(goalId, attemptId),
      start: (level) => startLevelTestOutAction(goalId, level),
    },
    undo: (changeId) => decidePlanChangeAction(goalId, { changeId, status: "undone" }),
  };
}
