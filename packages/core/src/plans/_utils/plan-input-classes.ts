import { z } from "zod";
import { type BuildPlanInput } from "../planner/build-plan";
import { getMissedMockRescueDays } from "../planner/mock-rescue-input";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "../planner/plan-items";
import { type Pace } from "../planner/plan-pace";
import { type PlanSettings, parsePlanSettings } from "../planner/plan-state";
import { type PlanCarrySnapshot, loadPlanCarrySnapshot } from "./carried-lessons";
import { listGivenLessonIds, selectLeftWork } from "./left-work";
import { type PlanContext } from "./plan-context";
import { getPlanInputsKey, hashKeyed, readKeyedInput } from "./plan-inputs-key";

/**
 * What a change to a planning input asks of the stored plan:
 * - `scope`: what the plan selects (its time and date, the Library, what the learner chose, what
 *   they showed they know or missed): one reselection;
 * - `placement`: where the selected work goes (the pace, moves, mock funding, work earlier days
 *   left, a missed mock's rescue): a re-flow that keeps the selection;
 * - `signal`: how ready the learner is, which orders what's selected: frozen until the next
 *   reselection, never a reshuffle on its own;
 * - `reduction`: finished work, which only takes work out (see `reduceCompletedSummary`).
 */
type PlanInputClass = "placement" | "reduction" | "scope" | "signal";

/** A field that's no input, with why: it says how a run is made, or it's the saved plan's output. */
type NoInput = { excluded: string };

/**
 * Every field of a planning run's input with its class (see `PlanInputClass`), or why it's no input:
 * it says how the run is made, or it's the saved plan's own output. A new field doesn't compile here
 * until it says which, as `KEYED_FIELDS` asks of the legacy key.
 */
const INPUT_CLASSES = {
  announcements: "scope",
  answeredWrongSkillIds: "scope",
  bands: "scope",
  bases: "scope",
  bossDays: "placement",
  bossFacts: "scope",
  bossMinutes: "placement",
  bringBackSetAside: {
    excluded: "Only a learner's change brings set-aside work back, and its plan holds it.",
  },
  carryOver: {
    excluded:
      "What earlier days left, read by mode and day: the key reads that work itself (`leftWork`).",
  },
  courseStart: "placement",
  examWindows: {
    excluded: "The exam's phases as the saved plan shows them: that plan's own dates.",
  },
  finishedOn: "reduction",
  fullMockMinutes: "scope",
  goal: "scope",
  goalId: { excluded: "Which goal a run's warnings name, not anything the plan plans." },
  graph: "scope",
  heldSkillsLand: {
    excluded: "Whether a landing's lessons include next chapters, whose lessons the key reads.",
  },
  items: "reduction",
  knownAreas: "scope",
  knownSkillIds: "scope",
  landedOnly: {
    excluded: "Whether the run's only news is a landing, whose lessons the key reads.",
  },
  lessons: "scope",
  levelFloor: "scope",
  missedSkillIds: "scope",
  mockClocks: "placement",
  mockMinutes: "scope",
  mode: {
    excluded: "How the run lays the plan out (from today, or after this week), not what it plans.",
  },
  movesPhaseEnds: {
    excluded: "Whether the run moves the phase ends shown, which the plan it saves holds.",
  },
  noticeAreas: "scope",
  paceFactor: "placement",
  phaseEnds: { excluded: "The phase end dates the saved plan shows: that plan's own dates." },
  prerequisites: "scope",
  quickLessons: "scope",
  readiness: "signal",
  requestedMoveDates: {
    excluded: "A change's requested move is funded where it asks or refused, never saved.",
  },
  setAsideLeftWork: {
    excluded: "Only a new day's settling sets work aside, and the plan it saved holds it.",
  },
  settings: { excluded: "Each of its fields says its own class (see `SETTINGS_CLASSES`)." },
  strongAreas: "scope",
  testedTeaching: {
    excluded: "A run's own pass before, settling its challenges: not what it plans from.",
  },
  today: {
    excluded:
      "A day that only begins is no news: the work it leaves and a missed mock's rescue are keyed.",
  },
  todayShown: {
    excluded: "Whether the learner saw today's session: the saved plan's today, as it is.",
  },
  topicLevels: "scope",
} satisfies Record<keyof BuildPlanInput, NoInput | PlanInputClass>;

/** Every field of the plan's settings with its class, or why it's no input (see `INPUT_CLASSES`). */
const SETTINGS_CLASSES = {
  baseChoices: "scope",
  checkpointOverflow: {
    excluded: "The checkpoints' overflow the last build derived, which no run reads.",
  },
  difficultyBias: "scope",
  examChoices: "scope",
  focusAreas: "scope",
  focusParts: "scope",
  fullCourse: "scope",
  lightWeeks: "scope",
  mockFunding: "placement",
  mockRelocations: "placement",
  movedEvents: "placement",
  noticeDate: "scope",
  pace: "placement",
  pastBasicsAreas: "scope",
  practiceBias: "scope",
  reducedAreas: "scope",
  shortMockMinutes: "scope",
  skippedActivities: "scope",
  skippedAreas: "scope",
  startDate: "scope",
  team: {
    excluded:
      "The colleagues in the plan's challenges, picked when the first is played: not planned.",
  },
  tools: "scope",
  weekdayMinutes: "scope",
  writtenCadence: "scope",
} satisfies Record<keyof PlanSettings, NoInput | PlanInputClass>;

/** The fields of a class, as a set (see `INPUT_CLASSES`). */
function listFields(
  classes: Record<string, NoInput | PlanInputClass>,
  of: PlanInputClass,
): Set<string> {
  return new Set(
    Object.entries(classes).flatMap(([field, value]) => (value === of ? [field] : [])),
  );
}

function pick(value: object, fields: ReadonlySet<string>) {
  return Object.fromEntries(Object.entries(value).filter(([field]) => fields.has(field)));
}

/** The item statuses that settle or set aside work: what a plan holds to do, so its scope. */
const SCOPE_STATUSES = new Set<PlannedItem["status"]>(["skipped", "testedOut"]);

/** Which classification the keys follow: a key of another version is compared again from scratch. */
const PLAN_INPUT_KEYS_VERSION = 1;

const planInputKeysSchema = z
  .object({ placement: z.string(), scope: z.string(), version: z.literal(PLAN_INPUT_KEYS_VERSION) })
  .strict();

/** The keys of what a stored layout was planned from: its scope and its placement. */
export type PlanInputKeys = z.infer<typeof planInputKeysSchema>;

/** Stored keys of this classification's version; null when missing or of another one. */
export function readLayoutKeys(value: unknown): PlanInputKeys | null {
  return planInputKeysSchema.safeParse(value).data ?? null;
}

/**
 * The pace a session's end sampled that the stored plan doesn't use yet (`Plan.pendingPace`).
 * @public An Open's gate reads the pace a session's end left waiting.
 */
export function readPendingPace(value: unknown): Pace | null {
  return value === null || value === undefined ? null : parsePlanSettings({ pace: value }).pace;
}

/**
 * What the clock adds to a plan's placement, loaded before any build, never from its output.
 * @public An Open's gate and a layout write read them.
 */
export type PlacementFacts = {
  /**
   * The work earlier days left, by item key in the plan's order (see `selectLeftWork`): lessons and
   * challenges due before today, and lessons the last study day gave that the plan has after it.
   */
  leftWork: readonly string[];
};

type PlacementItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId" | "status"
> & { id: string | null };

/**
 * The placement facts of these items (the stored plan's, or a layout's to save) on its today.
 * @public A gate that holds the day's carry already reads them without loading it again.
 */
export function readPlacementFacts({
  items,
  snapshot,
  today,
}: {
  items: readonly PlacementItem[];
  snapshot: PlanCarrySnapshot;
  today: Date;
}): PlacementFacts {
  return {
    leftWork: selectLeftWork({ givenLessonIds: listGivenLessonIds(snapshot), items, today }).map(
      (item) => getItemKey(item),
    ),
  };
}

/**
 * Loads what the placement facts need (the day's carry), then reads them (see `readPlacementFacts`).
 * @public An Open's gate and a layout write load them.
 */
export async function loadPlacementFacts({
  context,
  items,
}: {
  context: PlanContext;
  items: readonly PlacementItem[];
}): Promise<PlacementFacts> {
  const snapshot = await loadPlanCarrySnapshot(context);
  return readPlacementFacts({ items, snapshot, today: context.today });
}

/**
 * The scope and placement keys of what a run plans from (see `PlanInputClass`), from its input,
 * the plan's items as stored and the clock's placement facts, before any build: the same inputs
 * give the same keys, and a layout stores the keys of what the next input load reads back. Raw
 * today is in neither: a day that only begins changes nothing. Signals and finished work are in
 * neither either: they never reshuffle a plan on their own.
 * @public A layout write stores the keys of what it planned from.
 */
export function getPlanInputKeys({
  input,
  items,
  placement,
}: {
  input: BuildPlanInput;
  items: readonly Pick<PlannedItem, "key" | "status">[];
  placement: PlacementFacts;
}): PlanInputKeys {
  const read = readKeyedInput(input);

  const scope = {
    input: pick(read, listFields(INPUT_CLASSES, "scope")),
    membership: items
      .filter((item) => SCOPE_STATUSES.has(item.status))
      .map((item) => `${item.key}:${item.status}`)
      .toSorted(),
    settings: pick(read.settings, listFields(SETTINGS_CLASSES, "scope")),
  };

  const placed = {
    input: pick(read, listFields(INPUT_CLASSES, "placement")),
    leftWork: placement.leftWork,
    rescueDays: getMissedMockRescueDays(input),
    settings: pick(read.settings, listFields(SETTINGS_CLASSES, "placement")),
  };

  return {
    placement: hashKeyed(placed),
    scope: hashKeyed(scope),
    version: PLAN_INPUT_KEYS_VERSION,
  };
}

/**
 * What a gate decides from the keys of the stored layout and of the inputs now (see `comparePlanInputs`).
 * @public An Open's gate and a refresh act on it.
 */
export type PlanInputComparison =
  | { kind: "equal" }
  | { keys: PlanInputKeys; kind: "placement" | "rekey" | "scope" };

/**
 * Whether the stored plan is current with its inputs, before any build:
 * - `equal`: nothing it's planned from changed: no build;
 * - `rekey`: its keys are missing or of another version, but the legacy key says nothing changed
 *   and no work is left over: store the keys without building;
 * - `placement`: the same selection goes elsewhere: a re-flow that keeps it;
 * - `scope`: what the plan selects changed, or there's no telling: one reselection.
 * @public An Open's gate and a refresh decide with it, before any build.
 */
export function comparePlanInputs({
  input,
  items,
  placement,
  stored,
}: {
  input: BuildPlanInput;
  items: readonly Pick<PlannedItem, "key" | "status">[];
  placement: PlacementFacts;
  stored: { inputsKey: string | null; layoutKeys: unknown };
}): PlanInputComparison {
  const keys = getPlanInputKeys({ input, items, placement });
  const saved = readLayoutKeys(stored.layoutKeys);

  // A plan saved before the keys can take them without a build only when nothing it planned from
  // changed and no work is left over: the legacy key leaves out what earlier days left, which the
  // keys would otherwise take as planned, and nothing would ever lay it out.
  if (!saved) {
    const unchanged = getPlanInputsKey({ input, items }) === stored.inputsKey;

    if (!unchanged) {
      return { keys, kind: "scope" };
    }

    return { keys, kind: placement.leftWork.length === 0 ? "rekey" : "placement" };
  }

  if (saved.scope !== keys.scope) {
    return { keys, kind: "scope" };
  }

  return saved.placement === keys.placement ? { kind: "equal" } : { keys, kind: "placement" };
}
