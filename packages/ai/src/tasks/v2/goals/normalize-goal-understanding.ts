const MIN_DAILY_MINUTES = 5;
const MAX_DAILY_MINUTES = 240;
const DAYS_PER_WEEK = 7;
const MAX_GOALS = 3;
const MAX_FOLLOW_UPS = 2;
const MAX_TEXT_LENGTH = 120;
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/u;

type GoalUnderstandingRoute = "explain" | "goals" | "instrument" | "unclear" | "unsafe";
type UnderstoodGoalKind = "exam" | "language" | "learn";
type UnderstoodOwnLevel = "advanced" | "basic" | "intermediate" | "none";
type UnderstoodPurpose = "careerChange" | "deep" | "other" | "overview" | "refresh" | "work";

/** One goal as the model returned it: every field present, null when the text didn't say. */
type RawUnderstoodGoal = {
  examName: string | null;
  examYear: number | null;
  institution: string | null;
  kind: UnderstoodGoalKind;
  level: string | null;
  nativeLanguage: string | null;
  ownLevel: UnderstoodOwnLevel | null;
  purpose: UnderstoodPurpose | null;
  reason: string | null;
  role: string | null;
  subject: string;
  targetCourse: string | null;
  targetDate: string | null;
  targetLanguage: string | null;
  targetPosition: string | null;
  targetScore: string | null;
  title: string;
};

export type RawGoalUnderstanding = {
  dailyMinutes: number | null;
  followUps: string[];
  goals: RawUnderstoodGoal[];
  instrument: string | null;
  question: string | null;
  route: GoalUnderstandingRoute;
  studyDays: number[] | null;
  studyTime: string | null;
  studyTimeNote: string | null;
};

/** A goal onboarding can create: fields the text didn't give are undefined, never null. */
export type UnderstoodGoal = {
  examName?: string;
  examYear?: number;
  institution?: string;
  kind: UnderstoodGoalKind;
  level?: string;
  nativeLanguage?: string;
  ownLevel?: UnderstoodOwnLevel;
  purpose?: UnderstoodPurpose;
  reason?: string;
  role?: string;
  subject: string;
  targetCourse?: string;
  targetDate?: string;
  targetLanguage?: string;
  targetPosition?: string;
  targetScore?: string;
  title: string;
};

export type GoalUnderstanding =
  | { route: "explain"; question: string }
  | { instrument: string; route: "instrument" }
  | { route: "unclear" | "unsafe" }
  | {
      dailyMinutes?: number;
      followUps: string[];
      goals: UnderstoodGoal[];
      route: "goals";
      studyDays?: number[];
      studyTime?: string;
      studyTimeNote?: string;
    };

function cleanText(value: string | null): string | undefined {
  const text = value?.trim().slice(0, MAX_TEXT_LENGTH);
  return text || undefined;
}

function cleanDailyMinutes(value: number | null): number | undefined {
  if (value === null || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(MAX_DAILY_MINUTES, Math.max(MIN_DAILY_MINUTES, Math.round(value)));
}

function cleanStudyDays(days: number[] | null): number[] | undefined {
  if (!days) {
    return undefined;
  }

  const valid = [...new Set(days)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day < DAYS_PER_WEEK)
    .toSorted((a, b) => a - b);

  return valid.length > 0 ? valid : undefined;
}

/** Only real dates after today: a deadline in the past can't be planned for. */
function cleanTargetDate({ date, today }: { date: string | null; today: string }) {
  if (!date || !ISO_DATE_PATTERN.test(date) || Number.isNaN(Date.parse(date))) {
    return;
  }

  return date > today ? date : undefined;
}

function cleanLanguageCode(code: string | null): string | undefined {
  const trimmed = code?.trim();
  return trimmed && LANGUAGE_CODE_PATTERN.test(trimmed) ? trimmed : undefined;
}

function cleanYear(year: number | null): number | undefined {
  return year !== null && Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
    ? year
    : undefined;
}

function normalizeGoal({
  goal,
  today,
}: {
  goal: RawUnderstoodGoal;
  today: string;
}): UnderstoodGoal | null {
  const title = cleanText(goal.title);
  const targetLanguage = cleanLanguageCode(goal.targetLanguage);

  if (!title || (goal.kind === "language" && !targetLanguage)) {
    return null;
  }

  return {
    examName: goal.kind === "exam" ? cleanText(goal.examName) : undefined,
    examYear: goal.kind === "exam" ? cleanYear(goal.examYear) : undefined,
    institution: cleanText(goal.institution),
    kind: goal.kind,
    level: cleanText(goal.level),
    nativeLanguage: goal.kind === "language" ? cleanLanguageCode(goal.nativeLanguage) : undefined,
    ownLevel: goal.ownLevel ?? undefined,
    purpose: goal.kind === "learn" ? (goal.purpose ?? undefined) : undefined,
    reason: cleanText(goal.reason),
    role: cleanText(goal.role),
    subject: cleanText(goal.subject) ?? title,
    targetCourse: cleanText(goal.targetCourse),
    targetDate: cleanTargetDate({ date: goal.targetDate, today }),
    targetLanguage,
    targetPosition: cleanText(goal.targetPosition),
    targetScore: cleanText(goal.targetScore),
    title,
  };
}

function normalizeGoals(raw: RawGoalUnderstanding, today: string): GoalUnderstanding {
  const goals = raw.goals
    .slice(0, MAX_GOALS)
    .flatMap((goal) => normalizeGoal({ goal, today }) ?? []);

  if (goals.length === 0) {
    return { route: "unclear" };
  }

  const studyTime =
    raw.studyTime && STUDY_TIME_PATTERN.test(raw.studyTime) ? raw.studyTime : undefined;

  return {
    dailyMinutes: cleanDailyMinutes(raw.dailyMinutes),
    followUps: raw.followUps
      .flatMap((question) => cleanText(question) ?? [])
      .slice(0, MAX_FOLLOW_UPS),
    goals,
    route: "goals",
    studyDays: cleanStudyDays(raw.studyDays),
    studyTime,
    studyTimeNote: cleanText(raw.studyTimeNote),
  };
}

/**
 * Keeps only what onboarding can use: goals with a title (and a language for language goals),
 * real future dates, minutes the planner accepts and valid weekdays. A route that lost what it
 * needs (an explain without its question, goals without one usable goal) becomes `unclear`, so
 * the learner is asked to say more instead of getting a broken plan.
 */
export function normalizeGoalUnderstanding({
  raw,
  today,
}: {
  raw: RawGoalUnderstanding;
  today: string;
}): GoalUnderstanding {
  switch (raw.route) {
    case "explain": {
      const question = cleanText(raw.question);
      return question ? { question, route: "explain" } : { route: "unclear" };
    }
    case "instrument": {
      const instrument = cleanText(raw.instrument);
      return instrument ? { instrument, route: "instrument" } : { route: "unclear" };
    }
    case "goals":
      return normalizeGoals(raw, today);
    case "unclear":
    case "unsafe":
      return { route: raw.route };
    default:
      return { route: "unclear" };
  }
}
