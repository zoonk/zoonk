import { listCarriedItemIds } from "../planner/carried-items";
import { getNextMockMove } from "../planner/next-mock-move";
import { listPhaseEndMoves } from "../planner/phase-dates-move";
import { getFallingBehind } from "./falling-behind";
import { toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, type PlanChangeRecord } from "./replan";

/** Plain notes for logs and admin; the apps say these changes from their kind and numbers. */
const LEFT_WORK_NOTE = "Lessons earlier days left come first; the rest of the plan moved forward.";

/** The earlier days that left work: the days it was due, or the last study day for the rest. */
function countLeftDays({ context, left }: { context: PlanContext; left: PlanContext["items"] }) {
  const overdue = left.filter((item) => item.scheduledFor && item.scheduledFor < context.today);
  const days = new Set(overdue.map((item) => item.scheduledFor?.getTime())).size;

  return Math.max(1, days);
}

/** The mandatory notice saved by any POST that settles the same selected day's plan. */
export function getSettledPlanChange({
  context,
  computed,
  left,
}: {
  context: PlanContext;
  computed: ComputedPlan;
  left: PlanContext["items"];
}): PlanChangeRecord {
  const phaseEnds = listPhaseEndMoves({ after: computed.built.phases, shown: context.phases });

  const nextMock = getNextMockMove({
    after: computed.built.items,
    before: context.items,
    today: context.today,
  });

  return {
    kind: "missedDays",
    payload: toPlanChangePayload({
      behind: getFallingBehind({ computed, context }),
      carriedItemIds: listCarriedItemIds({
        items: computed.built.items,
        left: left.filter((item) => item.kind !== "boss"),
      }),
      days: countLeftDays({ context, left }),
      effect: {
        ...computed.effect,
        ...(phaseEnds.length > 0 && { phaseEnds }),
        ...(nextMock && { nextMock }),
      },
      source: "system",
    }),
    reason: LEFT_WORK_NOTE,
    status: "applied",
  };
}
