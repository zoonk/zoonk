import { normalizeString } from "@zoonk/utils/string";

const MIN_DAILY_MINUTES = 5;
const MAX_DAILY_MINUTES = 240;
const LAST_WEEKDAY = 6;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_DATE_LENGTH = 10;

const PRACTICE_BIASES = ["moreExplanation", "balanced", "morePractice"] as const;
export const LANGUAGE_ACTIVITIES = ["vocabulary", "listening", "writing", "speaking"] as const;
const DIFFICULTY_BIASES = ["easier", "standard", "harder"] as const;

type AreaKind = "focusAreas" | "restoreAreas" | "skipAreas";
type ActivityKind = "restoreActivities" | "skipActivities";

/** A change the planner applies, the same shape as core's plan operations. */
type PlanEditOperation =
  | { activities: (typeof LANGUAGE_ACTIVITIES)[number][]; kind: ActivityKind }
  | { areas: string[]; kind: AreaKind }
  | { bias: (typeof DIFFICULTY_BIASES)[number]; kind: "setDifficultyBias" }
  | { bias: (typeof PRACTICE_BIASES)[number]; kind: "setPracticeBias" }
  | { kind: "addLightWeek"; startDate: string }
  | { kind: "setDailyMinutes"; minutes: number }
  | { kind: "setTargetDate"; targetDate: string | null }
  | { kind: "setWeekdayMinutes"; minutes: number; weekdays: number[] };

export type PlanEdit = { operations: PlanEditOperation[]; summary: string; understood: boolean };

type RawChange = {
  activities: string[] | null;
  areas: string[] | null;
  bias: string | null;
  date: string | null;
  kind: string;
  minutes: number | null;
  weekdays: number[] | null;
};

type Context = { areas: readonly string[]; goalKind: string; today: string };

function isValidDate(value: string | null): value is string {
  return (
    value !== null &&
    ISO_DATE.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, ISO_DATE_LENGTH) === value
  );
}

function toMinutes({ min, value }: { min: number; value: number | null }): number | null {
  return value === null || !Number.isFinite(value)
    ? null
    : Math.min(MAX_DAILY_MINUTES, Math.max(min, Math.round(value)));
}

function toWeekdays(values: readonly number[] | null): number[] {
  const valid = (values ?? []).filter(
    (value) => Number.isInteger(value) && value >= 0 && value <= LAST_WEEKDAY,
  );

  return [...new Set(valid)].toSorted((a, b) => a - b);
}

/** Areas match the plan's names by meaning of case and accents only; unknown ones are dropped. */
function toAreas({ context, values }: { context: Context; values: readonly string[] | null }) {
  const known = new Map(context.areas.map((area) => [normalizeString(area), area]));

  return [
    ...new Set(
      (values ?? []).flatMap((value) => {
        const area = known.get(normalizeString(value));
        return area ? [area] : [];
      }),
    ),
  ];
}

function includes<const T extends string>(list: readonly T[], value: string | null): value is T {
  return list.some((item) => item === value);
}

function toAreaOperation({
  change,
  context,
  kind,
}: {
  change: RawChange;
  context: Context;
  kind: AreaKind;
}): PlanEditOperation | null {
  const areas = toAreas({ context, values: change.areas });
  return areas.length > 0 ? { areas, kind } : null;
}

/** Only a language plan has kinds of practice to leave out or bring back. */
function toActivityOperation({
  change,
  context,
  kind,
}: {
  change: RawChange;
  context: Context;
  kind: ActivityKind;
}): PlanEditOperation | null {
  const activities = [
    ...new Set((change.activities ?? []).filter((value) => includes(LANGUAGE_ACTIVITIES, value))),
  ];

  return context.goalKind === "language" && activities.length > 0 ? { activities, kind } : null;
}

function toBiasOperation(change: RawChange): PlanEditOperation | null {
  if (change.kind === "setPracticeBias" && includes(PRACTICE_BIASES, change.bias)) {
    return { bias: change.bias, kind: "setPracticeBias" };
  }

  if (change.kind === "setDifficultyBias" && includes(DIFFICULTY_BIASES, change.bias)) {
    return { bias: change.bias, kind: "setDifficultyBias" };
  }

  return null;
}

function toTimeOperation(change: RawChange): PlanEditOperation | null {
  if (change.kind === "setDailyMinutes") {
    const minutes = toMinutes({ min: MIN_DAILY_MINUTES, value: change.minutes });
    return minutes === null ? null : { kind: "setDailyMinutes", minutes };
  }

  const minutes = toMinutes({ min: 0, value: change.minutes });
  const weekdays = toWeekdays(change.weekdays);

  return minutes === null || weekdays.length === 0
    ? null
    : { kind: "setWeekdayMinutes", minutes, weekdays };
}

function toDateOperation({ change, context }: { change: RawChange; context: Context }) {
  if (change.kind === "clearTargetDate") {
    return { kind: "setTargetDate", targetDate: null } satisfies PlanEditOperation;
  }

  if (!isValidDate(change.date)) {
    return null;
  }

  if (change.kind === "addLightWeek") {
    return change.date >= context.today
      ? ({ kind: "addLightWeek", startDate: change.date } satisfies PlanEditOperation)
      : null;
  }

  return change.date > context.today
    ? ({ kind: "setTargetDate", targetDate: change.date } satisfies PlanEditOperation)
    : null;
}

function toOperation({
  change,
  context,
}: {
  change: RawChange;
  context: Context;
}): PlanEditOperation | null {
  switch (change.kind) {
    case "setDailyMinutes":
    case "setWeekdayMinutes":
      return toTimeOperation(change);
    case "addLightWeek":
    case "setTargetDate":
    case "clearTargetDate":
      return toDateOperation({ change, context });
    case "focusAreas":
    case "skipAreas":
    case "restoreAreas":
      return toAreaOperation({ change, context, kind: change.kind });
    case "skipActivities":
    case "restoreActivities":
      return toActivityOperation({ change, context, kind: change.kind });
    default:
      return toBiasOperation(change);
  }
}

/**
 * Keeps only the changes the planner can apply as written: minutes in range, real weekdays, dates
 * after today, and areas the plan has. When none is left, the request counts as not understood.
 */
export function normalizePlanEdit({
  input,
  raw,
}: {
  input: Context;
  raw: { changes: readonly RawChange[]; summary: string; understood: boolean };
}): PlanEdit {
  const operations = raw.understood
    ? raw.changes.flatMap((change) => toOperation({ change, context: input }) ?? [])
    : [];

  const understood = operations.length > 0;

  return { operations, summary: understood ? raw.summary.trim() : "", understood };
}
