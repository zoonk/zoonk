import { decodeHtmlEntities } from "../../_utils/html-entities";
import { type FocusPart, joinPartsByArea, toPartName } from "./focus-part-names";
import { matchAreas } from "./plan-edit-areas";
import {
  type DateOperation,
  type TimeOperation,
  isValidDate,
  toDateOperation,
  toTimeOperation,
} from "./plan-edit-calendar";
import { type PlanEditTopic, toTopicsOperation } from "./plan-edit-topics";
import { keepReducedOutOfFocus } from "./reduced-focus";

const PRACTICE_BIASES = ["moreExplanation", "balanced", "morePractice"] as const;
export const LANGUAGE_ACTIVITIES = ["vocabulary", "listening", "writing", "speaking"] as const;
const DIFFICULTY_BIASES = ["easier", "standard", "harder"] as const;
export const AREA_STARTS = ["pastBasics", "basics"] as const;
export const WRITTEN_CADENCES = ["weekly", "biweekly", "finalWeeks"] as const;

type AreaKind = "reduceAreas" | "restoreAreas" | "skipAreas";

type ActivityKind = "restoreActivities" | "skipActivities";

/** The same shape as core's plan operations. */
type PlanEditOperation =
  | { activities: (typeof LANGUAGE_ACTIVITIES)[number][]; kind: ActivityKind }
  | { areas: string[]; kind: AreaKind }
  | { areas: string[]; kind: "focusAreas"; parts?: FocusPart[] }
  | { areas: string[]; kind: "setAreaStart"; start: (typeof AREA_STARTS)[number] }
  | { bias: (typeof DIFFICULTY_BIASES)[number]; kind: "setDifficultyBias" }
  | { bias: (typeof PRACTICE_BIASES)[number]; kind: "setPracticeBias" }
  | DateOperation
  | TimeOperation
  | { cadence: (typeof WRITTEN_CADENCES)[number]; kind: "setWrittenCadence" }
  | { kind: "addTopics"; startDate: string | null; topics: PlanEditTopic[] };

export type PlanEdit = {
  /** In the learner's words. */
  leftOut: string[];
  operations: PlanEditOperation[];
  summary: string;
  understood: boolean;
};

/** A few short phrases are all a reply needs to answer them. */
const MAX_LEFT_OUT = 3;
const MAX_LEFT_OUT_LENGTH = 120;

type RawPart = { area: string; name: string; skills: string[] };

type RawChange = {
  activities: (typeof LANGUAGE_ACTIVITIES)[number][] | null;
  areas: string[] | null;
  cadence: (typeof WRITTEN_CADENCES)[number] | null;
  parts: RawPart[] | null;
  bias: string | null;
  date: string | null;
  kind: string;
  minutes: number | null;
  start: (typeof AREA_STARTS)[number] | null;
  topics: readonly PlanEditTopic[] | null;
  weekdays: number[] | null;
};

export type PlanEditSkill = { area: string; name: string; skillId: string };

type Context = {
  dailyMinutesLimits: { min: number; max: number };
  areas: readonly string[];
  goalKind: string;
  language?: string;
  skills?: readonly PlanEditSkill[];
  targetDate?: string | null;
  today: string;
  writtenParts?: readonly string[];
};

export function toSkillKey(index: number): string {
  return `K${index + 1}`;
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

/** A part left with no skills is dropped, so its area is focused whole. */
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

/** A focus always says its parts, none for whole areas, so it replaces an earlier focus's parts. */
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

function toAreaStartOperation({
  change,
  context,
}: {
  change: RawChange;
  context: Context;
}): PlanEditOperation | null {
  const areas = toAreas({ context, values: change.areas });
  const { start } = change;

  return areas.length > 0 && start ? { areas, kind: "setAreaStart", start } : null;
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
  const activities = [...new Set(change.activities)];

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
  const { cadence } = change;
  const hasWritten = (context.writtenParts ?? []).length > 0;

  if (!hasWritten || !cadence) {
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

/** Before the goal's date, since topics after it are never studied. Null spreads them instead. */
function toTopicsStart({ context, date }: { context: Context; date: string | null }) {
  if (!isValidDate(date) || date < context.today) {
    return null;
  }

  return context.targetDate && date >= context.targetDate ? null : date;
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
      return toTimeOperation({ change, dailyMinutesLimits: context.dailyMinutesLimits });
    case "addLightWeek":
    case "setTargetDate":
    case "clearTargetDate":
      return toDateOperation({ change, today: context.today });
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
        startDate: toTopicsStart({ context, date: change.date }),
        topics: change.topics ?? [],
      });
    default:
      return toBiasOperation(change);
  }
}

function shortenPhrase(text: string): string {
  return text.length > MAX_LEFT_OUT_LENGTH ? `${text.slice(0, MAX_LEFT_OUT_LENGTH - 1)}…` : text;
}

function toLeftOut(values: readonly string[] | null | undefined): string[] {
  const phrases = (values ?? []).map((value) => decodeHtmlEntities(value).trim()).filter(Boolean);
  return [...new Set(phrases)].slice(0, MAX_LEFT_OUT).map((phrase) => shortenPhrase(phrase));
}

/** When no change the planner can apply is left, the request counts as not understood. */
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
