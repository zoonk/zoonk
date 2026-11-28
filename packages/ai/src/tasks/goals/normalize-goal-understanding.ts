import { isCountryCode } from "@zoonk/utils/countries";
import { splitTargetLanguage } from "@zoonk/utils/language-regions";
import { LANGUAGE_CODE_PATTERN, toCanonicalLanguage } from "@zoonk/utils/languages";
import {
  type GoalUnderstanding,
  type RawGoalUnderstanding,
  type RawUnderstoodGoal,
  type UnderstoodGoal,
  type UnderstoodGoalKind,
} from "./understood-goal";

const DAYS_PER_WEEK = 7;
const MAX_GOALS = 3;
const MAX_FOLLOW_UPS = 2;
/** The learner's app sends the title back to POST /goals, which takes up to 120 characters. */
const MAX_TITLE_LENGTH = 120;
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

function cleanText(value: string | null): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

/** A copied "medicina" made a plan line read "medicina na UFMG…" (Oct 2026). */
function cleanCourseName(value: string | null): string | undefined {
  const text = cleanText(value);
  return text && `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}`;
}

function cleanTexts(values: string[] | null): string[] | undefined {
  const texts = [...new Set((values ?? []).flatMap((value) => cleanText(value) ?? []))];
  return texts.length > 0 ? texts : undefined;
}

function cleanDailyMinutes({
  limits,
  value,
}: {
  limits: { min: number; max: number };
  value: number | null;
}): number | undefined {
  if (value === null || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
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

function cleanNativeLanguage(code: string | null): string | undefined {
  const tag = cleanLanguageCode(code);
  return tag && toCanonicalLanguage(tag);
}

function cleanCountry(code: string | null): string | undefined {
  const upper = code?.trim().toUpperCase();
  return upper && isCountryCode(upper) ? upper : undefined;
}

function cleanTargetLanguage({
  code,
  kind,
}: {
  code: string | null;
  kind: UnderstoodGoalKind;
}): Pick<UnderstoodGoal, "targetLanguage" | "targetRegion"> {
  const tag = cleanLanguageCode(code);

  if (!tag) {
    return {};
  }

  const { targetLanguage, targetRegion } = splitTargetLanguage(tag);
  return { targetLanguage, targetRegion: (kind === "language" && targetRegion) || undefined };
}

const MONTHS_PER_YEAR = 12;

function cleanMonth(month: number | null): number | undefined {
  return month !== null && Number.isInteger(month) && month >= 1 && month <= MONTHS_PER_YEAR
    ? month
    : undefined;
}

function cleanYear(year: number | null): number | undefined {
  return year !== null && Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
    ? year
    : undefined;
}

/**
 * An exam one organizer runs everywhere has no country of the learner's: a country named with it
 * ("the SAT in Kenya") is only where they sit it.
 */
function hasOwnCountry(goal: RawUnderstoodGoal): boolean {
  return goal.kind === "learn" || (goal.kind === "exam" && goal.countryDependent);
}

/** A date the learner gave says they booked, whatever else the reading says. */
function isNotBooked({
  goal,
  targetDate,
}: {
  goal: RawUnderstoodGoal;
  targetDate: string | undefined;
}): true | undefined {
  return (
    (goal.kind === "exam" && goal.examDay === "booked" && goal.examNotBooked && !targetDate) ||
    undefined
  );
}

type ExamFields = Pick<
  UnderstoodGoal,
  | "examDay"
  | "examMonth"
  | "examName"
  | "examNotBooked"
  | "examOption"
  | "examSubjects"
  | "examTarget"
  | "examYear"
>;

/** Every exam field, undefined on other goals. */
function cleanExamFields({
  goal,
  targetDate,
}: {
  goal: RawUnderstoodGoal;
  targetDate: string | undefined;
}): ExamFields {
  const exam = goal.kind === "exam";

  return {
    examDay: exam ? (goal.examDay ?? undefined) : undefined,
    examMonth: exam ? cleanMonth(goal.examMonth) : undefined,
    examName: exam ? cleanText(goal.examName) : undefined,
    examNotBooked: isNotBooked({ goal, targetDate }),
    examOption: exam ? cleanText(goal.examOption) : undefined,
    examSubjects: exam ? cleanTexts(goal.examSubjects) : undefined,
    examTarget: exam ? (goal.examTarget ?? undefined) : undefined,
    examYear: exam ? cleanYear(goal.examYear) : undefined,
  };
}

function normalizeGoal({
  goal,
  today,
}: {
  goal: RawUnderstoodGoal;
  today: string;
}): UnderstoodGoal | null {
  const title = cleanText(goal.title.slice(0, MAX_TITLE_LENGTH));

  const { targetLanguage, targetRegion } = cleanTargetLanguage({
    code: goal.targetLanguage,
    kind: goal.kind,
  });

  if (!title || (goal.kind === "language" && !targetLanguage)) {
    return null;
  }

  const targetDate = cleanTargetDate({ date: goal.targetDate, today });

  return {
    contentCountry: hasOwnCountry(goal) ? cleanCountry(goal.contentCountry) : undefined,
    countryDependent: (goal.kind === "learn" || goal.kind === "exam") && goal.countryDependent,
    displayName: cleanText(goal.displayName ?? null),
    ...cleanExamFields({ goal, targetDate }),
    institution: cleanText(goal.institution),
    kind: goal.kind,
    level: cleanText(goal.level),
    nativeLanguage: goal.kind === "language" ? cleanNativeLanguage(goal.nativeLanguage) : undefined,
    ownLevel: goal.ownLevel ?? undefined,
    purpose: goal.kind === "learn" ? (goal.purpose ?? undefined) : undefined,
    reason: cleanText(goal.reason),
    role: cleanText(goal.role),
    subject: cleanText(goal.subject) ?? title,
    targetCourse: cleanCourseName(goal.targetCourse),
    targetDate,
    targetLanguage,
    targetPosition: cleanText(goal.targetPosition),
    targetRegion,
    targetScore: cleanText(goal.targetScore),
    title,
  };
}

type MaterialIntent = "exam" | "understand" | null;

/** The learner chose an exam on their material or to learn it, which models sometimes read the other way. */
function withChosenKind({
  goals: [main, ...others],
  materialIntent,
}: {
  goals: RawUnderstoodGoal[];
  materialIntent: MaterialIntent;
}): RawUnderstoodGoal[] {
  if (!main || !materialIntent || main.kind === "language") {
    return main ? [main, ...others] : others;
  }

  return [{ ...main, kind: materialIntent === "exam" ? "exam" : "learn" }, ...others];
}

function normalizeGoals({
  dailyMinutesLimits,
  materialIntent,
  raw,
  today,
}: {
  dailyMinutesLimits: { min: number; max: number };
  materialIntent: MaterialIntent;
  raw: RawGoalUnderstanding;
  today: string;
}): GoalUnderstanding {
  const kept = withChosenKind({ goals: raw.goals, materialIntent })
    .slice(0, MAX_GOALS)
    .flatMap((goal) => {
      const normalized = normalizeGoal({ goal, today });
      return normalized ? [{ followUps: goal.followUps, goal: normalized }] : [];
    });

  const [main] = kept;

  if (!main) {
    return { route: "unclear" };
  }

  const studyTime =
    raw.studyTime && STUDY_TIME_PATTERN.test(raw.studyTime) ? raw.studyTime : undefined;

  return {
    dailyMinutes: cleanDailyMinutes({ limits: dailyMinutesLimits, value: raw.dailyMinutes }),
    // Onboarding asks these while setting up the main goal, so another goal's would land on it.
    followUps: main.followUps
      .flatMap((question) => cleanText(question) ?? [])
      .slice(0, MAX_FOLLOW_UPS),
    goals: kept.map(({ goal }) => goal),
    route: "goals",
    studyDays: cleanStudyDays(raw.studyDays),
    studyTime,
    studyTimeNote: cleanText(raw.studyTimeNote),
  };
}

/**
 * A route that lost what it needs becomes `unclear`, so the learner is asked to say more instead of
 * getting a broken plan.
 */
export function normalizeGoalUnderstanding({
  dailyMinutesLimits,
  materialIntent = null,
  raw,
  today,
}: {
  dailyMinutesLimits: { min: number; max: number };
  /** What the learner chose to do with the material they attached, which sets the main goal's kind. */
  materialIntent?: MaterialIntent;
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
      return normalizeGoals({ dailyMinutesLimits, materialIntent, raw, today });
    case "unclear":
    case "unsafe":
      return { route: raw.route };
    default:
      return { route: "unclear" };
  }
}
