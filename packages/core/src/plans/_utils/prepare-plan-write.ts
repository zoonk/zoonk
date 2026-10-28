import "server-only";
import { prisma } from "@zoonk/db";
import { PHASE_DATES_SOURCE } from "../plan-change-contract";
import { getFullCourseEnd } from "../planner/after-exam";
import { showsPhaseDatesMove } from "../planner/phase-dates-move";
import { fromIsoDate } from "../planner/plan-calendar";
import { computeChange } from "./compute-change";
import { toComputedPlanWrite } from "./computed-plan-write";
import { loadFitOffer } from "./fit-offer";
import { applyChangeOperations } from "./part-areas";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { readShownFeasibility, toFeasibilityView } from "./plan-feasibility-view";
import { getPlanPreviewBasis } from "./plan-preview-basis";
import { readPlanSummary, toPlanSummary } from "./plan-summary";
import { type ComputedPlan } from "./replan";
import { retainPlanAllocation } from "./retained-plan-allocation";
import { type PlanWrite } from "./write-plan";

/** The context a successful write will publish, used for quotes against that exact allocation. */
function getComputedPlanContext({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): PlanContext {
  return {
    ...context,
    goal: {
      ...context.goal,
      dailyMinutes: computed.state.goal.dailyMinutes,
      targetDate: computed.state.goal.targetDate
        ? fromIsoDate(computed.state.goal.targetDate)
        : null,
    },
    items: computed.built.items.map((item, position) => ({
      ...item,
      facts: { ...computed.itemFacts.get(item.key), schemaVersion: 1 },
      id: item.id ?? item.key,
      position,
    })),
    phases: computed.built.phases,
    plan: { ...context.plan, version: context.plan.version + 1 },
    state: computed.state,
  };
}

/** Materialize lazy advice and waiting quotes before taking the learner lock. */
async function prepareReadModel({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}) {
  const summary = toPlanSummary({ context, selected: computed.selected });
  const saved = getComputedPlanContext({ computed, context });

  const feasibility = readShownFeasibility({
    coverage: computed.selected.coverage,
    feasibility: computed.feasibility,
  });

  const [fitOffer, previews] = await Promise.all([
    loadFitOffer({ baseline: computed, context: saved, feasibility }),
    prepareProposalPreviews({ baseline: computed, context: saved }),
  ]);

  return {
    previews,
    summary: {
      ...summary,
      advice: {
        feasibility: toFeasibilityView(feasibility),
        fitOffer,
        fullCourseEndDate: getFullCourseEnd({
          built: computed.built,
          end: computed.selected.endDate,
          targetDate: computed.state.goal.targetDate,
        }),
      },
    },
  };
}

export async function prepareProposalPreviews({
  baseline,
  context,
}: {
  baseline: ComputedPlan;
  context: PlanContext;
}) {
  const proposals = await prisma.planChange.findMany({
    where: { planId: context.plan.id, status: "proposed" },
  });

  return Promise.all(
    proposals.map(async (proposal) => {
      const payload = parsePlanChangePayload(proposal.payload);

      const result = await applyChangeOperations({
        context,
        noticeGraph: payload.noticeGraph,
        operations: payload.operations,
      });

      const change =
        "error" in result
          ? null
          : await computeChange({
              baseline,
              context,
              operations: result.operations,
              state: result.state,
            });

      const effect =
        change &&
        !change.unchanged &&
        (payload.source !== PHASE_DATES_SOURCE || showsPhaseDatesMove(change.effect))
          ? change.effect
          : null;

      return {
        id: proposal.id,
        payload: toPlanChangePayload({
          ...payload,
          effect,
          previewBasis: getPlanPreviewBasis(context),
        }),
      };
    }),
  );
}

/** A full layout and its materialized screen facts enter the same transaction. */
export async function preparePlanWrite(input: {
  computed: ComputedPlan;
  context: PlanContext;
}): Promise<PlanWrite> {
  return { ...toComputedPlanWrite(input), ...(await prepareReadModel(input)) };
}

/** Keep the shown allocation while refreshing its advice and quotes for new inputs. */
export async function prepareRetainedPlanWrite({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}) {
  const built = retainPlanAllocation({ built: computed.built, context });
  const selected = computed.summarizeRetained();

  const saved = readPlanSummary({
    plan: { ...context.plan, userId: context.goal.userId },
    value: context.plan.summary,
  });

  const readModel =
    built && selected
      ? await prepareReadModel({
          computed: { ...computed, built, selected },
          context: {
            ...context,
            plan: {
              ...context.plan,
              inputVersion: context.plan.inputVersion + 1,
              version: context.plan.version - 1,
            },
          },
        })
      : { previews: [], summary: saved };

  return { ...readModel, graph: computed.state.graph, inputsKey: computed.inputsKey };
}
