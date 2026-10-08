import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

const FULL = 10;
const MIN_SCORE = 1;
const MISS_PENALTY = 2;

/** One expected goal: its kind, and only the fields the words make certain. */
type ExpectedGoal = {
  /** The exam's month, 1 to 12, when the words name one without its day ("in January"). */
  examMonth?: number;
  examName?: RegExp;
  /** What the exam's learner aims for beyond passing; null for an exam only passed or failed. */
  examTarget?: "admission" | "position" | "score" | null;
  /** The exam's year, when the words name or imply one ("in January next year"). */
  examYear?: number;
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
  /** A language goal's target level (`targetScore`), such as /B2/. */
  targetLevel?: RegExp;
  /** The learner's current job, when the goal is for that work (`role`), such as /dados/. */
  role?: RegExp;
  /** Words the title must keep, such as the institution that names an exam. */
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

/** The exam's own facts: its name, year, month and what its learner aims for. */
function getExamChecks({
  expected,
  goal,
}: {
  expected: ExpectedGoal;
  goal: Record<string, unknown>;
}): [boolean, string][] {
  return [
    [
      !expected.examName ||
        (typeof goal.examName === "string" && expected.examName.test(goal.examName)),
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
      // The understanding leaves out what an exam doesn't have, so null reads as absent.
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
      !expected.targetLevel ||
        (typeof goal.targetScore === "string" && expected.targetLevel.test(goal.targetScore)),
      `target level ${show(goal.targetScore)}`,
    ],
    [!expected.purpose || goal.purpose === expected.purpose, `purpose ${show(goal.purpose)}`],
    [
      !expected.role || (typeof goal.role === "string" && expected.role.test(goal.role)),
      `role ${show(goal.role)}`,
    ],
    [!expected.hasTarget || hasTarget, "target missing"],
    [
      !expected.title || (typeof goal.title === "string" && expected.title.test(goal.title)),
      `title ${show(goal.title)}`,
    ],
  ];

  return [...checks.filter(([ok]) => !ok).map(([, problem]) => problem), ...checkTitle(goal)];
}

/**
 * The details the confirm screen shows as their own rows, which the title shouldn't repeat. A
 * career change's new role is the goal itself ("Become a data analyst"), so only an exam's
 * position counts.
 */
const ROW_FIELDS = ["examYear", "targetCourse", "targetScore"] as const;
const EXAM_ROW_FIELDS = [...ROW_FIELDS, "targetPosition"] as const;

/** Titles are headings: longer ones stack the details the rows already show. */
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
