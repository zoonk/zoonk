import { createHash } from "node:crypto";
import { type BuildPlanInput } from "../planner/build-plan";
import { withoutPlannedLessons } from "../planner/core-first";
import { findLanding } from "../planner/landed-lessons";
import { getMissedMockRescueDays } from "../planner/mock-rescue-input";
import { type PlannedItem, getItemKey } from "../planner/plan-items";
import { type PlannerLesson } from "../planner/plan-units";

const KEYED_FIELDS = {
  announcements: true,
  answeredWrongSkillIds: true,
  bands: true,
  bases: true,
  bossDays: true,
  bossFacts: true,
  bossMinutes: "The time each challenge took as the plan saved it: the plan's own output.",
  bringBackSetAside: "Only a learner's change brings set-aside work back, and its plan holds it.",
  carryOver: "What earlier days left, which the plan the run saved already lays out first.",
  courseStart: true,
  examWindows: "The exam's phases as the saved plan shows them: that plan's own dates.",
  finishedOn: true,
  fullMockMinutes: true,
  goal: true,
  goalId: "Which goal a run's warnings name, not anything the plan plans.",
  graph: true,
  heldSkillsLand: "Whether a landing's lessons include next chapters, whose lessons the key reads.",
  items: "The saved plan itself: only the learner's progress in it counts (see `progress`).",
  knownAreas: true,
  knownSkillIds: true,
  landedOnly: "Whether the run's only news is a landing, whose lessons the key reads.",
  lessons: true,
  levelFloor: true,
  missedSkillIds: true,
  mockClocks: true,
  mockMinutes: true,
  mode: "How the run lays the plan out (from today, or after this week), not what it plans.",
  movesPhaseEnds: "Whether the run moves the phase ends shown, which the plan it saves holds.",
  noticeAreas: true,
  paceFactor: true,
  phaseEnds: "The phase end dates the saved plan shows: that plan's own dates.",
  prerequisites: true,
  quickLessons: true,
  readiness: true,
  setAsideLeftWork: "Only a new day's settling sets work aside, and the plan it saved holds it.",
  settings: true,
  strongAreas: true,
  today:
    "Raw day rollover is not news; missed work settles separately and rescue eligibility is keyed.",
  todayShown: "Whether the learner saw today's session: the saved plan's today, as it is.",
  topicLevels: true,
} satisfies Record<keyof BuildPlanInput, string | true>;

const PLANNED_FIELDS = new Set(
  Object.entries(KEYED_FIELDS).flatMap(([field, keyed]) => (keyed === true ? [field] : [])),
);

export function shouldSkipPlanBuild({
  input,
  savedKey,
  skipUnchangedInputs,
}: {
  input: BuildPlanInput;
  savedKey: string | null | undefined;
  skipUnchangedInputs?: boolean;
}): boolean {
  return (
    skipUnchangedInputs === true &&
    getPlanInputsKey({
      input,
      items: input.items.map((item) => ({ key: getItemKey(item), status: item.status })),
    }) === savedKey
  );
}

function compareText(a: unknown, b: unknown): number {
  const [left, right] = [String(a), String(b)];

  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function isMap(value: unknown): value is ReadonlyMap<unknown, unknown> {
  return value instanceof Map;
}

function isSet(value: unknown): value is ReadonlySet<unknown> {
  return value instanceof Set;
}

function toStable(value: unknown): unknown {
  if (isMap(value)) {
    return [...value]
      .toSorted(([a], [b]) => compareText(a, b))
      .map(([key, entry]) => [key, toStable(entry)]);
  }

  if (isSet(value)) {
    return [...value].toSorted(compareText).map((entry) => toStable(entry));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toStable(entry));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .toSorted(([a], [b]) => compareText(a, b))
        .map(([key, entry]) => [key, toStable(entry)]),
    );
  }

  return value;
}

function toKeyedLessons(lessons: readonly PlannerLesson[]) {
  return lessons
    .map(({ chapterId, skillIds, ...lesson }) => ({
      ...lesson,
      ...(lesson.courseOrder && { chapterId }),
      skillIds: skillIds.toSorted(),
    }))
    .toSorted((a, b) => compareText(a.lessonId, b.lessonId));
}

function hashKeyed(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(toStable(value)))
    .digest("hex");
}

function readKeyedInput(input: BuildPlanInput) {
  return {
    ...input,
    bossFacts: input.bossFacts && {
      bank: input.bossFacts.bank,
      listeningSkillIds: input.bossFacts.listeningSkillIds,
      survivors: input.bossFacts.survivors,
    },
    graph: input.graph && withoutPlannedLessons(input.graph),
    lessons: input.lessons && toKeyedLessons(input.lessons),
    settings: input.settings && { ...input.settings, checkpointOverflow: [] },
  };
}

export function getPlanInputsKey({
  input,
  items,
}: {
  input: BuildPlanInput;
  items: readonly Pick<PlannedItem, "key" | "status">[];
}): string {
  const planned = Object.fromEntries(
    Object.entries(readKeyedInput(input)).filter(([field]) => PLANNED_FIELDS.has(field)),
  );

  const progress = items
    .filter((item) => item.status !== "todo")
    .map((item) => `${item.key}:${item.status}`)
    .toSorted();

  const rescueDays = getMissedMockRescueDays(input);

  return hashKeyed({ planned, progress, ...(rescueDays.length > 0 && { rescueDays }) });
}

export function readLanding({
  input,
  savedKey,
}: {
  input: BuildPlanInput;
  savedKey: string | null | undefined;
}): Pick<BuildPlanInput, "heldSkillsLand" | "landedOnly"> {
  const isOnly = (candidate: BuildPlanInput) => {
    const landing = savedKey ? findLanding(candidate) : null;

    return (
      landing !== null &&
      getPlanInputsKey({
        input: landing.asSaved,
        items: input.items.map((item) => ({ key: getItemKey(item), status: item.status })),
      }) === savedKey
    );
  };

  if (isOnly({ ...input, heldSkillsLand: true })) {
    return { heldSkillsLand: true, landedOnly: true };
  }

  return { landedOnly: isOnly(input) };
}
