import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { defineScoreCategories } from "@/lib/score-categories";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type PlannedActivityChange } from "@zoonk/ai/tasks/lesson-spec/activity-plan";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type LessonActivityPlanExpected } from "./test-cases";

export const LESSON_ACTIVITY_PLAN_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations:
      "It changes the screens where the learner can do the skill in a template that grades what they produce, and only those: the practice right after a worked example, a check after the skill is explained when it has none, and the application when the skill's real use is producing something. It leaves lessons about ideas as they are, and never picks a template that can't run the lesson's language or a sort into fits or doesn't fit.",
    id: "choice",
    label: "Right screens and templates",
    weight: 50,
  },
  {
    expectations:
      "Each new brief keeps the screen's idea, situation and tempting mistake, uses the lesson's own case, names and numbers, and asks only for what earlier screens teach. A codeRunner or sqlPlayground brief names the line the learner writes or fixes, what the program prints once it's right (every value the screen asks for, from the edited line) and what the tempting mistake prints; it never only runs a program that already works and never asks to predict the output.",
    id: "briefs",
    label: "Briefs the writer can follow",
    weight: 50,
  },
]);

type PlanOutput = { changes: PlannedActivityChange[]; spec: LessonSpec };

function parse(output: string): PlanOutput | null {
  try {
    return JSON.parse(output) as PlanOutput;
  } catch {
    return null;
  }
}

function findProblems({
  changes,
  expected,
}: {
  changes: readonly PlannedActivityChange[];
  expected: LessonActivityPlanExpected;
}): string[] {
  const changed = new Set(changes.map(({ index }) => index + 1));

  return [
    ...(expected.mustChange ?? []).flatMap((screen) =>
      changed.has(screen) ? [] : [`Screen ${screen} should become an activity.`],
    ),
    ...(expected.changes === true && changes.length === 0
      ? ["At least one screen should become an activity."]
      : []),
    ...(expected.changes === false && changes.length > 0
      ? [`No screen should change; screens ${[...changed].join(", ")} did.`]
      : []),
    ...changes.flatMap(({ activityTemplate, index }) => {
      const allowed = !expected.templates || expected.templates.includes(activityTemplate);
      const forbidden = expected.forbiddenTemplates?.includes(activityTemplate) ?? false;

      return allowed && !forbidden
        ? []
        : [`Screen ${index + 1} uses ${activityTemplate}, which doesn't fit this lesson.`];
    }),
  ];
}

export const checkLessonActivityPlan: TaskCodeChecks<LessonActivityPlanExpected> = ({
  output,
  testCase,
}) => {
  const plan = parse(output);

  if (!plan) {
    const problems = ["The output isn't a revised plan."];
    return { blockingProblems: problems, judgedOutput: output, passed: 0, problems, total: 1 };
  }

  const problems = findProblems({ changes: plan.changes, expected: testCase.expected ?? {} });
  const total = Math.max(1, problems.length);

  return {
    judgedOutput: JSON.stringify({
      changed: plan.changes.map(({ index }) => ({
        screen: index + 1,
        ...plan.spec.screens[index],
      })),
    }),
    passed: problems.length === 0 ? total : 0,
    problems,
    total,
  };
};

export const scoreLessonActivityPlan: TaskScorer<LessonActivityPlanExpected> = ({
  output,
  testCase,
}) =>
  scoreWithCodeChecks({
    check: (value) => checkLessonActivityPlan({ output: value, testCase }),
    output,
    scoreCategories: LESSON_ACTIVITY_PLAN_SCORE_CATEGORIES,
    testCase,
  });
