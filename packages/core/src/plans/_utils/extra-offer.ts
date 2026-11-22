import { isDeepStrictEqual } from "node:util";
import "server-only";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { type LearnerPlanOperation, type PlanOperation } from "../plan-contract";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { getItemKey } from "../planner/plan-items";
import { type PlanState } from "../planner/plan-state";
import { computeChange } from "./compute-change";
import { loadFitOffer } from "./fit-offer";
import { type PlanContext } from "./plan-context";
import { readShownFeasibility } from "./plan-feasibility-view";
import { type ComputedPlan } from "./replan";
import { readSelectedItemFacts } from "./selected-item-contract";

function listUnaskedExtras(state: PlanState): string[] {
  const catalog = state.graph.extraSkills;

  if (!catalog || catalog.length === 0) {
    return [];
  }

  const asked = new Set(state.settings.extras);

  const ordinary = new Set(
    state.graph.skills.filter((skill) => !skill.extra).map((skill) => skill.skillId),
  );

  return [
    ...new Set(
      catalog.map((skill) => skill.skillId).filter((id) => !asked.has(id) && !ordinary.has(id)),
    ),
  ].toSorted();
}

function keepsNoticeLessons({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): boolean {
  const extraIds = new Set(
    [...context.state.graph.skills, ...computed.state.graph.skills]
      .filter((skill) => skill.extra)
      .map((skill) => skill.skillId),
  );

  const isNotice = (item: Pick<PlanContext["items"][number], "kind" | "skillId" | "status">) =>
    item.status === "todo" && LEARN_KINDS.has(item.kind) && !extraIds.has(item.skillId ?? "");

  const before = context.items.filter(isNotice);
  const after = new Map(computed.built.items.filter(isNotice).map((item) => [item.key, item]));

  return (
    before.length === after.size &&
    before.every((item) => {
      const key = getItemKey(item);
      const next = after.get(key);
      const facts = readSelectedItemFacts(item.facts);
      const days = computed.itemFacts.get(key)?.days;

      return (
        next?.scheduledFor?.getTime() === item.scheduledFor?.getTime() &&
        (item.lessonId !== null || (next?.lessons ?? item.lessons) === item.lessons) &&
        isDeepStrictEqual(days, facts?.days)
      );
    })
  );
}

async function hasScheduledExtras({
  computed,
  offered,
}: {
  computed: ComputedPlan;
  offered: readonly string[];
}): Promise<boolean> {
  const marked = new Set(
    computed.state.graph.skills.filter((skill) => skill.extra).map((skill) => skill.skillId),
  );

  const scheduled = new Set(
    computed.built.items.flatMap((item) =>
      item.status === "todo" && item.skillId && marked.has(item.skillId) ? [item.skillId] : [],
    ),
  );

  if (scheduled.size === 0) {
    return false;
  }

  const missing = offered.filter((id) => !scheduled.has(id));
  const survivorOf = missing.length > 0 ? await loadSkillSurvivors(missing) : null;
  return !survivorOf || missing.every((id) => scheduled.has(survivorOf(id)));
}

async function extrasAreUnavailable({
  baseline,
  computed,
  context,
  fitOffer,
  operations,
  state,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  context: PlanContext;
  fitOffer?: boolean;
  operations: readonly PlanOperation[];
  state: PlanState;
}): Promise<boolean> {
  if (!operations.some((operation) => operation.kind === "setExtras")) {
    return false;
  }

  const asked = new Set(context.state.settings.extras);
  const additions = (state.settings.extras ?? []).filter((id) => !asked.has(id));

  if (additions.length === 0) {
    return false;
  }

  const offered = listUnaskedExtras(context.state);

  if (
    operations.length !== 1 ||
    !state.goal.targetDate ||
    baseline.materialExam ||
    !baseline.feasibility.fits ||
    !computed.feasibility.fits ||
    offered.length !== additions.length ||
    !offered.every((id) => additions.includes(id)) ||
    !keepsNoticeLessons({ computed, context }) ||
    !(await hasScheduledExtras({ computed, offered }))
  ) {
    return true;
  }

  return (
    fitOffer ??
    (await loadFitOffer({
      baseline,
      context,
      feasibility: readShownFeasibility({
        coverage: baseline.selected.coverage,
        feasibility: baseline.feasibility,
      }),
    })) !== null
  );
}

export async function computeCheckedChange(
  request: Parameters<typeof computeChange>[0] & { fitOffer?: boolean },
) {
  const change = await computeChange(request);
  const unavailable = await extrasAreUnavailable({ ...request, ...change });

  return unavailable ? { error: "extraUnavailable" as const } : change;
}

export async function loadExtraOffer({
  baseline,
  context,
}: {
  baseline: ComputedPlan;
  context: PlanContext;
}) {
  const unasked = listUnaskedExtras(context.state);

  if (
    unasked.length === 0 ||
    !context.state.goal.targetDate ||
    baseline.materialExam ||
    !baseline.feasibility.fits
  ) {
    return null;
  }

  const extras = [...new Set([...(context.state.settings.extras ?? []), ...unasked])].toSorted();
  const operations: LearnerPlanOperation[] = [{ kind: "setExtras", skillIds: extras }];

  const change = await computeCheckedChange({
    baseline,
    context,
    fitOffer: false,
    operations,
    state: { ...context.state, settings: { ...context.state.settings, extras } },
  });

  if ("error" in change) {
    return null;
  }

  const lessons = change.effect.lessonsAdded;

  return change.unchanged || lessons <= 0
    ? null
    : { effect: change.effect, fits: true, lessons, operations };
}
