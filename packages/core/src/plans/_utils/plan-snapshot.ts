import { PlanItemKind, PlanItemStatus } from "@zoonk/db";
import { z } from "zod";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";
import {
  type PlanPhase,
  type PlanState,
  parsePlanGraph,
  parsePlanPhases,
  parsePlanSettings,
  planStateSchema,
} from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
import { isStandIn } from "./stand-in-lessons";

const snapshotItemSchema = z.object({
  chapterId: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  id: z.string(),
  kind: z.enum(PlanItemKind),
  lessonId: z.string().nullable(),
  lessons: z.int().nullable(),
  phase: z.int(),
  scheduledFor: z.iso.date().nullable(),
  skillId: z.string().nullable(),
  status: z.enum(PlanItemStatus),
  titleSnapshot: z.string(),
});

const planSnapshotSchema = z.object({
  coveredShare: z.number().nullable(),
  estimateHours: z.number().nullable(),
  inputsKey: z.string().nullable().default(null),
  items: z.array(snapshotItemSchema),
  phases: z.unknown(),
  state: z.object({ goal: planStateSchema.shape.goal, graph: z.unknown(), settings: z.unknown() }),
});

/**
 * The plan as the learner had it right before a change they can undo (an edit, or a test-out's
 * skipped lessons): its state, phases, numbers and items, each with its day and status. The undo
 * puts it back as it was. Planned again from the state before instead, an undo moved every phase
 * end the plan had kept and hundreds of lessons a day or two, and gave back a plan the learner
 * never had.
 */
export type PlanSnapshot = {
  coveredShare: number | null;
  estimateHours: number | null;
  /** What the plan was planned from, which the undo gives back with it (see `getPlanInputsKey`). */
  inputsKey: string | null;
  items: ExistingPlanItem[];
  phases: PlanPhase[];
  state: PlanState;
};

/** The plan in a context as a snapshot stores it (see `PlanSnapshot`). */
export function toPlanSnapshot(context: PlanContext) {
  return {
    coveredShare: context.plan.coveredShare,
    estimateHours: context.plan.estimateHours,
    inputsKey: context.plan.inputsKey,
    items: context.items.map((item) => ({
      chapterId: item.chapterId,
      completedAt: item.completedAt?.toISOString() ?? null,
      id: item.id,
      kind: item.kind,
      lessonId: item.lessonId,
      lessons: item.lessons ?? null,
      phase: item.phase,
      scheduledFor: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
      skillId: item.skillId,
      status: item.status,
      titleSnapshot: item.titleSnapshot,
    })),
    phases: context.phases,
    state: context.state,
  };
}

/** A stored snapshot, or null when it isn't one. */
export function parsePlanSnapshot(value: unknown): PlanSnapshot | null {
  const parsed = planSnapshotSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const { items, phases, state, ...plan } = parsed.data;

  return {
    ...plan,
    items: items.map((item, position) => ({
      ...item,
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
      position,
      scheduledFor: item.scheduledFor ? fromIsoDate(item.scheduledFor) : null,
    })),
    phases: parsePlanPhases(phases),
    state: {
      goal: state.goal,
      graph: parsePlanGraph(state.graph),
      settings: parsePlanSettings(state.settings),
    },
  };
}

/** The lessons each skill's stand-in taught in a snapshot, which its items keep. */
export function getSnapshotStandInLessons(snapshot: PlanSnapshot): Map<string, number> {
  return new Map(
    snapshot.items.flatMap((item) =>
      isStandIn(item) && item.skillId && item.lessons !== null && item.lessons !== undefined
        ? [[item.skillId, item.lessons] as const]
        : [],
    ),
  );
}
