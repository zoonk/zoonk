import { type Goal, type PlanChangeStatus } from "@zoonk/db";
import { type ClaimEvent } from "../../../learner/_utils/skill-claims";
import { type OwnLevel } from "../../../learner/placement/placement-steps";
import { type getFallingBehind } from "../../_utils/falling-behind";
import { type PlanContext } from "../../_utils/plan-context";
import { getTodayExceptAreas } from "../../_utils/steered-areas";
import { type PlanOperation } from "../../plan-contract";
import { type CarryOver } from "../../planner/carry-over";
import { fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { type PlanEffect } from "../../planner/plan-effect";
import { type ExistingPlanItem } from "../../planner/plan-items";
import { type PaceSample } from "../../planner/plan-pace";
import { type PlanPhase, type PlanState, parsePlanSettings } from "../../planner/plan-state";
import { type PlannerLesson } from "../../planner/plan-units";
import { type SkillReadiness } from "../../planner/skill-order";
import { type SimInputs } from "./sim-inputs";

const NOON_MS = 43_200_000;

/** The moment a step happens: the learner studies at noon. */
export function atNoon(day: Date): Date {
  return new Date(day.getTime() + NOON_MS);
}

/** Plan items a learner studies: a lesson, or a chapter whose next lesson the session picks. */
export const LEARN_KINDS: ReadonlySet<string> = new Set(["chapter", "lesson"]);

/** A plan as saved: what every planning run starts from. */
export type SimPlan = {
  coveredShare: number | null;
  /** What the plan was planned from (see `getPlanInputsKey`); absent until a run saves one. */
  inputsKey?: string | null;
  items: ExistingPlanItem[];
  /**
   * The skills the learner showed they know as the planning run that built the plan read them:
   * answers after its last run count from the next one.
   */
  knownSkillIds?: readonly string[];
  phases: PlanPhase[];
  state: PlanState;
  version: number;
};

/** A change the plan recorded for the learner to see. */
export type SimChange = {
  /** For settling earlier days' work: the drop in what the plan covers that Today says. */
  behind?: ReturnType<typeof getFallingBehind>;
  /** For settling earlier days' work: the items it carried (the payload's `carriedItemIds`). */
  carriedItemIds?: string[];
  day: string;
  effect: PlanEffect | null;
  /** A `PlanChangeKind`, as plan changes store it. */
  kind: string;
  operations: PlanOperation[];
  /** For a test-out: the items it skipped, which its undo puts back (the payload's `planItemIds`). */
  planItemIds?: string[];
  /** For a change the learner can undo: the plan right before it, which the undo puts back. */
  snapshot?: SimPlan;
  source: string;
  status: PlanChangeStatus;
};

/** What the simulated learner's history tells the planner (the learner model's part of it). */
type SimLearnerModel = {
  /** Subjects the learner said they know in onboarding (`details.knownSubjects`). */
  knownSubjects: string[];
  /** The learner's own pace against lesson estimates, once they finished lessons. */
  own: PaceSample | null;
  /** The level they stated in onboarding (`details.level`), if they did. */
  ownLevel: OwnLevel | null;
  /** Each tested skill's memory on the exam day. */
  readiness: Map<string, SkillReadiness>;
  /** Plus learners take mocks; for others a mock day is the full review. */
  subscribed: boolean;
  /** Placement's answers, as the learner model reads a test's (see `listGapSkillIds`). */
  testAnswers: ClaimEvent[];
};

/** Everything a planning run reads: the library, the learner, the plan as saved, and today. */
export type SimWorld = {
  /** Changes recorded so far, oldest first. */
  changes: SimChange[];
  inputs: SimInputs;
  /** Lessons the Library outlined after the fixture's: each landed skill's new lessons. */
  landedLessons: PlannerLesson[];
  learner: SimLearnerModel;
  /** The fixture's lessons as the planner loads them now (see `SimInputs.loadLessons`). */
  lessons: PlannerLesson[];
  plan: SimPlan;
  /** Skills whose lessons the Library hasn't outlined yet: stand-ins plan in their place. */
  pendingSkills: ReadonlySet<string>;
  /** Each day's session, by day. */
  sessions: Map<string, SimSession>;
  today: Date;
};

/** A day's session: its lessons in order, the challenges it duels, and the plan version it follows. */
export type SimSession = { duels: string[]; lessons: string[]; version: number };

/** The goal row a planning run reads, with the fields the planner reads from it. */
export function getSimGoal(world: Pick<SimWorld, "inputs" | "learner" | "plan">): Goal {
  const { inputs, learner, plan } = world;
  const { goal } = inputs.library.fixture;

  return {
    createdAt: new Date(0),
    dailyMinutes: plan.state.goal.dailyMinutes,
    details: {
      ...inputs.goal.details,
      knownSubjects: learner.knownSubjects,
      ...(learner.ownLevel && { level: learner.ownLevel }),
    },
    examBlueprintId: inputs.goal.examBlueprintId,
    generationRunId: null,
    id: "sim-goal",
    kind: inputs.goal.kind,
    language: goal.language,
    primaryCourseId: inputs.library.primaryCourseId,
    prompt: "",
    researchRunId: null,
    researchUploadReason: null,
    status: "active",
    studyTime: null,
    targetDate: plan.state.goal.targetDate ? fromIsoDate(plan.state.goal.targetDate) : null,
    targetLanguage: goal.targetLanguage,
    timezone: "UTC",
    title: "",
    updatedAt: new Date(0),
    userId: "sim-user",
  };
}

/** The context a real planning run would load for this world. */
export function toSimContext(world: SimWorld): PlanContext {
  return {
    goal: getSimGoal(world),
    items: world.plan.items,
    phases: world.plan.phases,
    plan: {
      checkedInputVersion: null,
      coveredShare: world.plan.coveredShare,
      estimateHours: null,
      id: "sim-plan",
      inputVersion: 0,
      inputsKey: world.plan.inputsKey ?? null,
      layoutKeys: null,
      noticeWaitUntil: null,
      pendingAdaptation: [],
      pendingPace: null,
      sourceSkillIds: world.plan.state.graph.skills.map((skill) => skill.skillId),
      summary: null,
      version: world.plan.version,
    },
    state: world.plan.state,
    timeZone: "UTC",
    today: world.today,
  };
}

/** What the last study day before today gave the learner and they didn't finish. */
export function getSimCarryOver(world: SimWorld): CarryOver {
  const today = toIsoDate(world.today);
  const days = [...world.sessions.keys()].filter((day) => day < today).toSorted();
  const lastDay = days.at(-1);
  const given = lastDay ? (world.sessions.get(lastDay)?.lessons ?? []) : [];

  const done = new Set(
    world.plan.items.flatMap((item) => (item.status === "todo" ? [] : [item.lessonId ?? ""])),
  );

  return { lessonIds: given.filter((lessonId) => !done.has(lessonId)) };
}

/**
 * `computePlan`'s carry-over (`loadPlanCarryOver`): a forced run's, and an automatic run's on a day
 * that settled what earlier days left or that a change of focus steered, each with the items that
 * day's settling carried and that focus's steering. An automatic run after a change applied since
 * the settling doesn't carry its items again.
 */
export function getSimPlanCarryOver({
  mode,
  world,
}: {
  mode: "automatic" | "forced";
  world: SimWorld;
}): CarryOver | null {
  const today = toIsoDate(world.today);

  const settledAt = world.changes.findLastIndex(
    (change) => change.kind === "missedDays" && change.day === today,
  );

  const editedAt = world.changes.findLastIndex(
    (change) => change.kind === "edited" && change.status === "applied" && change.day === today,
  );

  const edited = mode === "automatic" ? world.changes[editedAt] : undefined;
  const settled = edited && editedAt > settledAt ? undefined : world.changes[settledAt];
  const steered = edited ? getTodayExceptAreas(edited.operations) : null;

  if (mode === "automatic" && !settled && !steered) {
    return null;
  }

  return {
    ...getSimCarryOver(world),
    itemIds: settled?.carriedItemIds ?? [],
    ...(steered && { todayExceptAreas: steered }),
  };
}

/** An empty plan for a goal, as goal creation leaves it. */
export function emptySimPlan({
  dailyMinutes,
  inputs,
  targetDate,
}: {
  dailyMinutes: number;
  inputs: SimInputs;
  targetDate: string | null;
}): SimPlan {
  return {
    coveredShare: null,
    items: [],
    phases: [],
    state: {
      goal: { dailyMinutes, targetDate },
      graph: inputs.library.graph,
      settings: parsePlanSettings({}),
    },
    version: 0,
  };
}
