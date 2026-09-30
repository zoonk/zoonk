import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

const FULL = 10;
const MIN_SCORE = 1;
const MISS_PENALTY = 2;

/** One expected goal: its kind, and only the fields the words make certain. */
type ExpectedGoal = {
  examName?: RegExp;
  hasTargetDate?: boolean;
  /** The deadline's month, YYYY-MM, when the words name one. */
  month?: string;
  nativeLanguage?: string;
  ownLevel?: string;
  purpose?: string;
  targetLanguage?: string;
  kind: "exam" | "language" | "learn";
  /** A target (score, course or position) is filled in. */
  hasTarget?: boolean;
};

export type UnderstandGoalExpected = {
  dailyMinutes?: number;
  goals?: ExpectedGoal[];
  hasStudyTime?: boolean;
  route: "explain" | "goals" | "instrument" | "unclear" | "unsafe";
  studyDays?: number[];
};

type Output = Record<string, unknown>;

/** Values as JSON in the conclusion, so objects and nulls read clearly. */
function show(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

function readOutput(output: string): Output | null {
  try {
    const parsed: unknown = JSON.parse(output);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function checkGoal({ expected, goal }: { expected: ExpectedGoal; goal: unknown }): string[] {
  if (!isJsonObject(goal)) {
    return [`missing ${expected.kind} goal`];
  }

  const targetDate = typeof goal.targetDate === "string" ? goal.targetDate : null;
  const hasTarget = [goal.targetScore, goal.targetCourse, goal.targetPosition].some(Boolean);

  const checks: [boolean, string][] = [
    [goal.kind === expected.kind, `kind ${show(goal.kind)} instead of ${expected.kind}`],
    [
      !expected.examName ||
        (typeof goal.examName === "string" && expected.examName.test(goal.examName)),
      `exam ${show(goal.examName)}`,
    ],
    [
      expected.hasTargetDate === undefined || Boolean(targetDate) === expected.hasTargetDate,
      `date ${show(targetDate)}`,
    ],
    [
      !expected.month || Boolean(targetDate?.startsWith(expected.month)),
      `date ${show(targetDate)} not in ${expected.month}`,
    ],
    [
      !expected.targetLanguage || goal.targetLanguage === expected.targetLanguage,
      `language ${show(goal.targetLanguage)}`,
    ],
    [
      !expected.nativeLanguage || goal.nativeLanguage === expected.nativeLanguage,
      `speaks ${show(goal.nativeLanguage)}`,
    ],
    [!expected.ownLevel || goal.ownLevel === expected.ownLevel, `level ${show(goal.ownLevel)}`],
    [!expected.purpose || goal.purpose === expected.purpose, `purpose ${show(goal.purpose)}`],
    [!expected.hasTarget || hasTarget, "target missing"],
  ];

  return checks.filter(([ok]) => !ok).map(([, problem]) => problem);
}

function checkSchedule({ expected, output }: { expected: UnderstandGoalExpected; output: Output }) {
  const days = Array.isArray(output.studyDays) ? output.studyDays : [];

  const checks: [boolean, string][] = [
    [
      expected.dailyMinutes === undefined || output.dailyMinutes === expected.dailyMinutes,
      `minutes ${show(output.dailyMinutes)}`,
    ],
    [!expected.hasStudyTime || typeof output.studyTime === "string", "study time missing"],
    [
      !expected.studyDays ||
        (days.length === expected.studyDays.length &&
          expected.studyDays.every((day) => days.includes(day))),
      `days ${JSON.stringify(days)}`,
    ],
  ];

  return checks.filter(([ok]) => !ok).map(([, problem]) => problem);
}

/**
 * The route decides where the learner goes, so a wrong route scores 1. With the right route,
 * each fact that's wrong or missing costs 2 points. Evaluation models (Jev) only return the
 * route, so their rows score the route alone.
 */
export const scoreUnderstandGoal: TaskScorer<UnderstandGoalExpected> = ({ output, testCase }) => {
  const expected = testCase.expected;
  const parsed = readOutput(output);

  if (!expected || !parsed) {
    return createFixedScore({ conclusion: "Unreadable output", score: MIN_SCORE });
  }

  const classification = {
    expected: expected.route,
    predicted: typeof parsed.route === "string" ? parsed.route : null,
  };

  if (parsed.route !== expected.route) {
    return {
      ...createFixedScore({ conclusion: `Route ${show(parsed.route)}`, score: MIN_SCORE }),
      classification,
    };
  }

  const goals = Array.isArray(parsed.goals) ? parsed.goals : null;

  const problems = [
    ...(expected.goals && goals && goals.length !== expected.goals.length
      ? [`${goals.length} goals`]
      : []),
    ...(goals
      ? (expected.goals ?? []).flatMap((goal, index) =>
          checkGoal({ expected: goal, goal: goals[index] }),
        )
      : []),
    ...(goals ? checkSchedule({ expected, output: parsed }) : []),
  ];

  const score = Math.max(MIN_SCORE, FULL - problems.length * MISS_PENALTY);

  return {
    ...createFixedScore({ conclusion: problems.join("; ") || "None", score }),
    classification,
  };
};
