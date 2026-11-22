import "server-only";
import { type PlanChangeStatus } from "@zoonk/db";
import { once } from "@zoonk/utils/once";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { type BuiltPlan, type PlanningMode, buildPlan } from "../planner/build-plan";
import { getChosenStandInLessons } from "../planner/chosen-bases";
import { withPlannedLessons } from "../planner/core-first";
import { type StudyScheduleAt } from "../planner/daily-time-plans";
import { withoutExamExtras } from "../planner/exam-extras";
import { type PlanBases } from "../planner/plan-bases";
import { type PlanEffect } from "../planner/plan-effect";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { type Pace } from "../planner/plan-pace";
import { type PlanState } from "../planner/plan-state";
import { getRunEffect, withBuiltSettings } from "../planner/run-outcome";
import { type SelectedItemFacts, listSelectedItemFacts } from "../planner/selected-item-facts";
import { summarizeSelectedPlan } from "../planner/selected-plan-summary";
import { type PlanCarrySnapshot } from "./carried-lessons";
import { withPlacedExtras } from "./extra-plan-graph";
import { layOutUnmetPhaseDates } from "./phase-end-layout";
import { type PlanChangeKind, type StoredPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { getPlanInputsKey, readLanding, shouldSkipPlanBuild } from "./plan-inputs-key";
import { readReplanInputs } from "./replan-input";
import { summarizeRetainedPlan } from "./retained-plan-allocation";
import { type SelectedSummary } from "./selected-summary-contract";

export type ComputedPlan = {
  bases: PlanBases;
  built: BuiltPlan;
  courseRanks: ReadonlyMap<string, number>;
  effect: PlanEffect;
  feasibility: PlanFeasibility;
  inputsKey: string;
  itemFacts: ReadonlyMap<string, SelectedItemFacts>;
  materialExam?: boolean;
  keptPhaseEnds: ReadonlyMap<number, Date> | undefined;
  mode: PlanningMode;
  pace: Pace;
  standInLessons: Map<string, number>;
  state: PlanState;
  selected: SelectedSummary;
  summarizeRetained: () => SelectedSummary | null;
};

export type ComputedChange = {
  baseline: ComputedPlan;
  bringsBackSetAside: boolean;
  computed: ComputedPlan;
  contradicts: boolean;
  effect: PlanEffect;
  unchanged: boolean;
};

export type PlanChangeRecord = {
  kind: PlanChangeKind;
  payload: StoredPlanChangePayload;
  provenance?: { generatedAt: Date; model: string; promptVersion: string; runId: string } | null;
  reason: string;
  status: PlanChangeStatus;
};

export type PlanTagRevalidation = "now" | "skip";

export type ComputePlanRequest = {
  carrySnapshot?: PlanCarrySnapshot;
  bringBackExtras?: boolean;
  bringBackSetAside?: boolean;
  context: PlanContext;
  keepPhaseDates?: boolean;
  mode: PlanningMode;
  movedEnds?: ReadonlyMap<number, string>;
  now?: Date;
  openedKeys?: readonly string[];
  pace?: "sampled" | "saved";
  releasedPhases?: ReadonlySet<number>;
  setAsideLeftWork?: boolean;
  state?: PlanState;
  todayExceptAreas?: readonly string[] | null;
  todayShown?: boolean;
  studyScheduleAt?: StudyScheduleAt;
};

/** Plans a goal from a state without saving anything. */
export function computePlan(
  input: ComputePlanRequest & { skipUnchangedInputs: true },
): Promise<ComputedPlan | null>;
export function computePlan(input: ComputePlanRequest): Promise<ComputedPlan>;
export async function computePlan({
  skipUnchangedInputs,
  ...request
}: ComputePlanRequest & { skipUnchangedInputs?: boolean }): Promise<ComputedPlan | null> {
  const { context, mode, state = context.state, studyScheduleAt } = request;

  const { advise, examSubjects, extraSkills, fullGraph, graph, input, materialExam, settings } =
    await readReplanInputs({ ...request, state });

  // Compare the inputs before the producer changes its own funding: its output isn't news.
  if (shouldSkipPlanBuild({ input, savedKey: context.plan.inputsKey, skipUnchangedInputs })) {
    return null;
  }

  const builtInput = {
    ...input,
    ...readLanding({ input, savedKey: context.plan.inputsKey }),
    ...(materialExam && { graph: withoutExamExtras(input).graph }),
  };

  const built = buildPlan(builtInput);

  const laidOut = await layOutUnmetPhaseDates({
    built,
    compute: computePlan,
    graph,
    kept: input.phaseEnds,
    request,
  });

  if (laidOut) {
    return laidOut;
  }

  const bases = once(advise);

  const feasibility = once(() =>
    getPlanFeasibility({
      examSubjects,
      input,
      planned: built,
      plannedInput: builtInput,
      studyScheduleAt,
    }),
  );

  const selected = once(() => summarizeSelectedPlan({ built, examSubjects, input: builtInput }));

  const standInLessons = getChosenStandInLessons(builtInput);

  const saved = withPlannedLessons({
    graph: withPlacedExtras({ built, extraSkills, graph: fullGraph }),
    skillLessons: built.skillLessons,
  });

  const savedSettings = withBuiltSettings({ built, settings });

  return {
    get bases() {
      return bases();
    },
    built,
    courseRanks: new Map(builtInput.lessons.map((lesson, rank) => [lesson.lessonId, rank])),
    effect: getRunEffect({ built, context, graph: saved, kept: input.phaseEnds, standInLessons }),
    get feasibility() {
      return feasibility();
    },
    inputsKey: getPlanInputsKey({
      input: { ...input, settings: savedSettings },
      items: built.items,
    }),
    itemFacts: listSelectedItemFacts({ built, input: builtInput }),
    keptPhaseEnds: input.phaseEnds,
    materialExam,
    mode,
    pace: settings.pace,
    get selected() {
      return selected();
    },
    standInLessons,
    state: { ...state, graph: saved, settings: savedSettings },
    summarizeRetained: () =>
      summarizeRetainedPlan({ built, context, examSubjects, input: builtInput }),
  };
}

export function revalidatePlanTags(userId: string) {
  revalidateCacheTags([getGoalsCacheTag(userId), getLearnerModelCacheTag(userId)]);
}
