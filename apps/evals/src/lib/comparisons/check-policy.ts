import { type Comparison } from "./schemas";

type Check = Comparison["checks"][number];
type Rules = NonNullable<Comparison["manifest"]["priorities"]["comparison"]>;

const keyCriteria: Readonly<Record<string, string>> = {
  "alphabet-lesson": "accuracy",
  "challenge-case": "accuracy",
  "generate-items": "correctness",
  "language-lesson": "accuracy",
  "language-sentence-orders": "precision",
  "lesson-writer": "accuracy",
  "level-test-bank": "answers",
  "past-questions": "keys",
  "placement-items": "correctness",
  "quick-explanation": "accuracy",
  "statute-drills": "legalAccuracy",
  "step-variant": "faithful",
  "warm-up-cards": "accuracy",
  "write-item-set": "keys",
  "write-listening-set": "keys",
};

const codeCriteria: Readonly<Record<string, string>> = {
  "generate-items": "correctness",
  "language-sentence-orders": "precision",
  "lesson-marks": "marks",
  "lesson-spec": "screenPlan",
  "lesson-writer": "fitAndApplication",
  "level-test-bank": "calibration",
  "past-questions": "selection",
  "placement-items": "skillFit",
  "statute-drills": "coverage",
  "write-item-set": "stimulus",
  "write-listening-set": "examRealism",
};

export function checkCriteria(taskId: string, name: string) {
  if (name === "answer keys") {
    return [keyCriteria[taskId] ?? name];
  }

  if (name === "background and frame") {
    return ["style"];
  }

  return [codeCriteria[taskId] ?? name];
}

export function hasCheckFailure(check: Check) {
  return check.passed < check.total || check.problems.length > 0 || hasBlockingCheck(check);
}

export function hasBlockingCheck(check: Check) {
  return (check.blockingProblems?.length ?? 0) > 0;
}

export function applyCheckPolicy({ check, taskId }: { check: Check; taskId: string }): Check {
  if (
    taskId !== "lesson-writer" ||
    check.name !== "code checks" ||
    !check.blockingProblems?.length
  ) {
    return check;
  }

  // The writer comparison samples first drafts, which production sends to a fixer on gate failure.
  return {
    ...check,
    blockingProblems: undefined,
    problems: [...new Set([...check.problems, ...check.blockingProblems])],
  };
}

export function criterionWeight(rules: Rules | undefined, criterion: string) {
  return rules?.criteria[criterion] === "disqualifies" ? null : (rules?.weights?.[criterion] ?? 1);
}
