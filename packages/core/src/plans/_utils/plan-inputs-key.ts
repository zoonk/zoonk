import { createHash } from "node:crypto";
import { type BuildPlanInput } from "../planner/build-plan";
import { withoutPlannedLessons } from "../planner/core-first";
import { findLanding } from "../planner/landed-lessons";
import { getMissedMockRescueDays } from "../planner/mock-rescue-input";
import { type PlannedItem, getItemKey } from "../planner/plan-items";
import { type PlannerLesson } from "../planner/plan-units";

/**
 * Every field of a planning run's input, as the key reads it: `true` when it's part of what the
 * plan is planned from, or why it's left out: it says how the run was made, which the plan the run
 * saved already holds. A new field doesn't compile here until it says which.
 */
const KEYED_FIELDS = {
  announcements: true,
  answeredWrongSkillIds: true,
  bands: true,
  bases: true,
  bossDays: true,
  bossFacts: true,
  bossMinutes: true,
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
  keepSelection: "A move-only run pins the selection the saved plan already holds.",
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
  requestedMoveDates: "A change's requested move is funded where it asks or refused, never saved.",
  setAsideLeftWork: "Only a new day's settling sets work aside, and the plan it saved holds it.",
  settings: true,
  strongAreas: true,
  testedTeaching: "A run's own pass before, settling its challenges: not what it plans from.",
  today:
    "Raw day rollover is not news; missed work settles separately and rescue eligibility is keyed.",
  todayShown: "Whether the learner saw today's session: the saved plan's today, as it is.",
  topicLevels: true,
} satisfies Record<keyof BuildPlanInput, string | true>;

const PLANNED_FIELDS = new Set(
  Object.entries(KEYED_FIELDS).flatMap(([field, keyed]) => (keyed === true ? [field] : [])),
);

/** An automatic run compares its actual inputs before derived output can look like new input. */
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

/** Sorts keys as text, whatever they are. */
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

/**
 * A value as JSON that says the same thing the same way: maps and sets as sorted entries, object
 * fields sorted and dates as text, so the same inputs always give the same key.
 */
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

/**
 * The Library's lessons as the key reads them: by id, each without the chapter it's planned in. An
 * outline that also places a lesson written before in its new chapter can give the lesson that
 * chapter and move it in the course order, which is no news for the plan: read in order with its
 * chapter, a career plan's day-one landing read as more than lessons written for its stand-in.
 */
function toKeyedLessons(lessons: readonly PlannerLesson[]) {
  return lessons
    .map(({ chapterId: _chapterId, skillIds, ...lesson }) => ({
      ...lesson,
      skillIds: skillIds.toSorted(),
    }))
    .toSorted((a, b) => compareText(a.lessonId, b.lessonId));
}

/** The hash of a value as JSON that says the same thing the same way (see `toStable`). */
export function hashKeyed(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(toStable(value)))
    .digest("hex");
}

/**
 * A planning run's input as every key reads it: the graph without the lessons the last build
 * counted, the Library's lessons by id without their chapter, what the bank holds for the bosses,
 * and the settings without the checkpoints' overflow the build derived, which no run reads.
 */
export function readKeyedInput(input: BuildPlanInput) {
  return {
    ...input,
    // What the bank holds for the bosses; the skills the Library says lessons teach are in the
    // lessons, and the kept items' in their progress.
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

/**
 * What a planning run plans from, which a later run reads the same way when nothing new happened:
 * what the planner reads (see `KEYED_FIELDS`: the goal's time and date, the graph, the settings and
 * pace, the Library's lessons, what the learner showed they know or missed, the bases) and the
 * learner's progress (the plan's items no longer to do, with their status). A system refresh whose
 * key matches the saved plan's has nothing to plan again (see `refreshGoalPlan`): planned again
 * another way, the same inputs moved 600 items of an OAB plan made that morning.
 */
export function getPlanInputsKey({
  input,
  items,
}: {
  input: BuildPlanInput;
  /** The plan's items as the run saves them, which the next run reads. */
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

/**
 * Whether an automatic run's only news is lessons the Library wrote for the plan's stand-ins: its
 * input without them (see `findLanding`) is the one the plan was saved from (`savedKey`), with the
 * same progress. Such a run keeps every other item as the plan has it (see `landedOnly`). The
 * lessons of skills the plan holds lessons of count when the input without them is the saved one
 * too: they were written since, not left out by the plan's cut (see `heldSkillsLand`).
 */
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
