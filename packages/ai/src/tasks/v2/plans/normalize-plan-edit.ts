import { decodeHtmlEntities } from "../../_utils/html-entities";
import { type FocusPart, joinPartsByArea, toPartName } from "./focus-part-names";
import { matchAreas } from "./plan-edit-areas";
import { type PlanEditTopic, toTopicsOperation } from "./plan-edit-topics";
import { keepReducedOutOfFocus } from "./reduced-focus";

const MIN_DAILY_MINUTES = 5;
const MAX_DAILY_MINUTES = 240;
const LAST_WEEKDAY = 6;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_DATE_LENGTH = 10;

const PRACTICE_BIASES = ["moreExplanation", "balanced", "morePractice"] as const;
export const LANGUAGE_ACTIVITIES = ["vocabulary", "listening", "writing", "speaking"] as const;
const DIFFICULTY_BIASES = ["easier", "standard", "harder"] as const;
export const AREA_STARTS = ["pastBasics", "basics"] as const;
export const WRITTEN_CADENCES = ["weekly", "biweekly", "finalWeeks"] as const;

type AreaKind = "reduceAreas" | "restoreAreas" | "skipAreas";

type ActivityKind = "restoreActivities" | "skipActivities";

/** A change the planner applies, the same shape as core's plan operations. */
type PlanEditOperation =
  | { activities: (typeof LANGUAGE_ACTIVITIES)[number][]; kind: ActivityKind }
  | { areas: string[]; kind: AreaKind }
  | { areas: string[]; kind: "focusAreas"; parts?: FocusPart[] }
  | { areas: string[]; kind: "setAreaStart"; start: (typeof AREA_STARTS)[number] }
  | { bias: (typeof DIFFICULTY_BIASES)[number]; kind: "setDifficultyBias" }
  | { bias: (typeof PRACTICE_BIASES)[number]; kind: "setPracticeBias" }
  | { kind: "addLightWeek"; startDate: string }
  | { kind: "setDailyMinutes"; minutes: number }
  | { kind: "setTargetDate"; targetDate: string | null }
  | { kind: "setWeekdayMinutes"; minutes: number; weekdays: number[] }
  | { cadence: (typeof WRITTEN_CADENCES)[number]; kind: "setWrittenCadence" }
  | { kind: "addTopics"; topics: PlanEditTopic[] };

export type PlanEdit = {
  /** Parts of the request no change covers (a target score, a question), in the learner's words. */
  leftOut: string[];
  operations: PlanEditOperation[];
  summary: string;
  understood: boolean;
};

/** A few short phrases are all a reply needs to answer them. */
const MAX_LEFT_OUT = 3;
const MAX_LEFT_OUT_LENGTH = 120;

/** A part of an area as the model named it: its skills by their keys ("K12"). */
type RawPart = { area: string; name: string; skills: string[] };

type RawChange = {
  activities: string[] | null;
  areas: string[] | null;
  /** Older outputs and other kinds have none. */
  cadence?: string | null;
  /** Older outputs and other kinds have none. */
  parts?: RawPart[] | null;
  bias: string | null;
  date: string | null;
  kind: string;
  minutes: number | null;
  /** Older outputs and other kinds have none. */
  start?: string | null;
  /** Older outputs and other kinds have none. */
  topics?: readonly PlanEditTopic[] | null;
  weekdays: number[] | null;
};

/** A skill of the plan, as the prompt lists it under its area by key (see `toSkillKey`). */
export type PlanEditSkill = { area: string; name: string; skillId: string };

type Context = {
  areas: readonly string[];
  goalKind: string;
  /** `routine` fits a new plan to the learner's routine: it only changes days and weeks. */
  purpose?: "edit" | "routine";
  /** The learner's language, for a part's name joined from several ("Biologia e Química"). */
  language?: string;
  /** The plan's skills, for a focus on part of an area; absent when the caller lists none. */
  skills?: readonly PlanEditSkill[];
  targetDate?: string | null;
  today: string;
  /** The exam's written tests (a redação, a discursive test); absent or empty when it has none. */
  writtenParts?: readonly string[];
};

/** A skill's key in the prompt: its place in the list, from 1 ("K12"). */
export function toSkillKey(index: number): string {
  return `K${index + 1}`;
}

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

function toAreas({ context, values }: { context: Context; values: readonly string[] | null }) {
  return matchAreas({ areas: context.areas, values });
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

/**
 * The parts of the focused areas the learner named, each with the skills of its own area the
 * model picked by key; a part left with none is dropped, so its area is focused whole.
 */
function toFocusParts({
  areas,
  context,
  parts,
}: {
  areas: readonly string[];
  context: Context;
  parts: readonly RawPart[];
}): FocusPart[] {
  const skills = context.skills ?? [];
  const byKey = new Map(skills.map((skill, index) => [toSkillKey(index), skill]));

  const named = parts.flatMap((part) => {
    const [area] = toAreas({ context, values: [part.area] });
    const name = toPartName(part.name);

    const skillIds = [
      ...new Set(
        part.skills.flatMap((key) => {
          const skill = byKey.get(key.trim());
          return skill && skill.area === area ? [skill.skillId] : [];
        }),
      ),
    ];

    return area && areas.includes(area) && name && skillIds.length > 0
      ? [{ area, name, skillIds }]
      : [];
  });

  return joinPartsByArea({ language: context.language, parts: named });
}

/**
 * Areas the plan has, each focused whole or in the part the learner named. A focus the learner
 * asks for always says its parts, none when they named whole areas, so it replaces the parts an
 * earlier focus named.
 */
function toFocusOperation({
  change,
  context,
}: {
  change: RawChange;
  context: Context;
}): PlanEditOperation | null {
  const areas = toAreas({ context, values: change.areas });
  const parts = toFocusParts({ areas, context, parts: change.parts ?? [] });

  return areas.length > 0 ? { areas, kind: "focusAreas", parts } : null;
}

/** Areas the plan has, starting past their basics or from them again. */
function toAreaStartOperation({
  change,
  context,
}: {
  change: RawChange;
  context: Context;
}): PlanEditOperation | null {
  const areas = toAreas({ context, values: change.areas });
  const start = change.start ?? null;

  return areas.length > 0 && includes(AREA_STARTS, start)
    ? { areas, kind: "setAreaStart", start }
    : null;
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

/**
 * Only a plan with written tests has a cadence to change, and only a plan with a date has final
 * weeks to keep them for.
 */
function toCadenceOperation({
  change,
  context,
}: {
  change: RawChange;
  context: Context;
}): PlanEditOperation | null {
  const cadence = change.cadence ?? null;
  const hasWritten = (context.writtenParts ?? []).length > 0;

  if (!hasWritten || !includes(WRITTEN_CADENCES, cadence)) {
    return null;
  }

  return cadence === "finalWeeks" && !context.targetDate
    ? null
    : { cadence, kind: "setWrittenCadence" };
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
      return toFocusOperation({ change, context });
    case "skipAreas":
    case "restoreAreas":
    case "reduceAreas":
      return toAreaOperation({ change, context, kind: change.kind });
    case "setAreaStart":
      return toAreaStartOperation({ change, context });
    case "skipActivities":
    case "restoreActivities":
      return toActivityOperation({ change, context, kind: change.kind });
    case "setWrittenCadence":
      return toCadenceOperation({ change, context });
    case "addTopics":
      return toTopicsOperation({
        areas: context.areas,
        purpose: context.purpose,
        topics: change.topics ?? [],
      });
    default:
      return toBiasOperation(change);
  }
}

function shortenPhrase(text: string): string {
  return text.length > MAX_LEFT_OUT_LENGTH ? `${text.slice(0, MAX_LEFT_OUT_LENGTH - 1)}…` : text;
}

/** The parts no change covers, once each, trimmed and short. */
function toLeftOut(values: readonly string[] | null | undefined): string[] {
  const phrases = (values ?? []).map((value) => decodeHtmlEntities(value).trim()).filter(Boolean);
  return [...new Set(phrases)].slice(0, MAX_LEFT_OUT).map((phrase) => shortenPhrase(phrase));
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
  raw: {
    changes: readonly RawChange[];
    leftOut?: readonly string[] | null;
    summary: string;
    understood: boolean;
  };
}): PlanEdit {
  const operations = raw.understood
    ? keepReducedOutOfFocus(
        raw.changes.flatMap((change) => toOperation({ change, context: input }) ?? []),
      )
    : [];

  const understood = operations.length > 0;

  return {
    leftOut: understood ? toLeftOut(raw.leftOut) : [],
    operations,
    summary: understood ? decodeHtmlEntities(raw.summary).trim() : "",
    understood,
  };
}
