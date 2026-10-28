import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

const FULL = 10;
const MIN_SCORE = 1;
const MISS_PENALTY = 2;

type ExpectedGoal = {
  examMonth?: number;
  examName?: RegExp;
  examTarget?: "admission" | "position" | "score" | null;
  examYear?: number;
  hasTargetDate?: boolean;
  month?: string;
  nativeLanguage?: string;
  ownLevel?: string;
  purpose?: string;
  targetLanguage?: string;
  kind: "exam" | "language" | "learn";
  hasTarget?: boolean;
  targetScore?: RegExp;
  targetCourse?: RegExp;
  institution?: RegExp;
  role?: RegExp;
  title?: RegExp;
};

export type UnderstandGoalExpected = {
  dailyMinutes?: number;
  goals?: ExpectedGoal[];
  hasStudyTime?: boolean;
  route: "explain" | "goals" | "instrument" | "unclear" | "unsafe";
  studyDays?: number[];
};

type Output = Record<string, unknown>;

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

function matchesText({ pattern, value }: { pattern: RegExp | undefined; value: unknown }) {
  return !pattern || (typeof value === "string" && pattern.test(value));
}

function getExamChecks({
  expected,
  goal,
}: {
  expected: ExpectedGoal;
  goal: Record<string, unknown>;
}): [boolean, string][] {
  return [
    [
      matchesText({ pattern: expected.examName, value: goal.examName }),
      `exam ${show(goal.examName)}`,
    ],
    [
      expected.examYear === undefined || goal.examYear === expected.examYear,
      `exam year ${show(goal.examYear)}`,
    ],
    [
      expected.examMonth === undefined || goal.examMonth === expected.examMonth,
      `exam month ${show(goal.examMonth)}`,
    ],
    [
      expected.examTarget === undefined || (goal.examTarget ?? null) === expected.examTarget,
      `exam target ${show(goal.examTarget)}`,
    ],
  ];
}

function checkGoal({ expected, goal }: { expected: ExpectedGoal; goal: unknown }): string[] {
  if (!isJsonObject(goal)) {
    return [`missing ${expected.kind} goal`];
  }

  const targetDate = typeof goal.targetDate === "string" ? goal.targetDate : null;
  const hasTarget = [goal.targetScore, goal.targetCourse, goal.targetPosition].some(Boolean);

  const checks: [boolean, string][] = [
    [goal.kind === expected.kind, `kind ${show(goal.kind)} instead of ${expected.kind}`],
    ...getExamChecks({ expected, goal }),
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
    [
      matchesText({ pattern: expected.targetScore, value: goal.targetScore }),
      `target score ${show(goal.targetScore)}`,
    ],
    [
      matchesText({ pattern: expected.targetCourse, value: goal.targetCourse }),
      `course ${show(goal.targetCourse)}`,
    ],
    [
      matchesText({ pattern: expected.institution, value: goal.institution }),
      `institution ${show(goal.institution)}`,
    ],
    [!expected.purpose || goal.purpose === expected.purpose, `purpose ${show(goal.purpose)}`],
    [matchesText({ pattern: expected.role, value: goal.role }), `role ${show(goal.role)}`],
    [!expected.hasTarget || hasTarget, "target missing"],
    [matchesText({ pattern: expected.title, value: goal.title }), `title ${show(goal.title)}`],
  ];

  return [...checks.filter(([ok]) => !ok).map(([, problem]) => problem), ...checkTitle(goal)];
}

const ROW_FIELDS = ["examYear", "targetCourse", "targetScore"] as const;
const EXAM_ROW_FIELDS = [...ROW_FIELDS, "targetPosition"] as const;

const MAX_TITLE_WORDS = 8;

function checkTitle(goal: Record<string, unknown>): string[] {
  const title = typeof goal.title === "string" ? goal.title.toLowerCase() : "";
  const words = title.split(/\s+/u).filter(Boolean).length;

  const fields = goal.kind === "exam" ? EXAM_ROW_FIELDS : ROW_FIELDS;

  const repeated = fields.filter((field) => {
    const value = goal[field];
    const text = typeof value === "string" || typeof value === "number" ? String(value) : "";

    return text !== "" && title.includes(text.toLowerCase());
  });

  return [
    ...(words > MAX_TITLE_WORDS ? [`title has ${words} words`] : []),
    ...repeated.map((field) => `title repeats ${field}`),
  ];
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
