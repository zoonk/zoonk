import "server-only";
import { PlanItemKind, PlanItemStatus, type TransactionClient } from "@zoonk/db";
import { z } from "zod";
import {
  type DaySessionSnapshot,
  captureDaySession,
  daySessionSnapshotSchema,
} from "../../sessions/_utils/day-session-snapshot";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import {
  type PlanPhase,
  type PlanState,
  parsePlanGraph,
  parsePlanPhases,
  parsePlanSettings,
  planStateSchema,
} from "../planner/plan-state";
import { type ContextPlanItem, type PlanContext } from "./plan-context";
import { type PlanSummary, planSummarySchema } from "./plan-summary";
import { readSelectedItemFacts, selectedItemFactsSchema } from "./selected-item-contract";
import { isStandIn } from "./stand-in-lessons";

const snapshotItemSchema = z.object({
  chapterId: z.string().nullable(),
  completedAt: z.iso.datetime().nullable(),
  facts: selectedItemFactsSchema.nullable(),
  id: z.string(),
  kind: z.enum(PlanItemKind),
  lessonId: z.string().nullable(),
  lessons: z.int().nullable(),
  minutes: z.number().nonnegative().nullable(),
  phase: z.int(),
  scheduledFor: z.iso.date().nullable(),
  skillId: z.string().nullable(),
  status: z.enum(PlanItemStatus),
  titleSnapshot: z.string(),
});

const planSnapshotSchema = z.object({
  coveredShare: z.number().nullable(),
  estimateHours: z.number().nullable(),
  inputsKey: z.string().nullable(),
  items: z.array(snapshotItemSchema),
  phases: z.unknown(),
  sourceSkillIds: z.array(z.string()),
  state: z.object({ goal: planStateSchema.shape.goal, graph: z.unknown(), settings: z.unknown() }),
  summary: planSummarySchema.nullable(),
  todaySession: daySessionSnapshotSchema.nullable(),
});

/**
 * The plan as the learner had it right before a change they can undo (an edit, or a test-out's
 * skipped lessons): its state, phases, numbers and items, each with its day and status, and
 * today's session (see `DaySessionSnapshot`). The undo puts it back as it was. Planned again from
 * the state before instead, an undo moved every phase end the plan had kept and hundreds of
 * lessons a day or two, and gave back a plan the learner never had.
 */
export type PlanSnapshot = {
  coveredShare: number | null;
  estimateHours: number | null;
  /** What the plan was planned from, which the undo gives back with it (see `getPlanInputsKey`). */
  inputsKey: string | null;
  items: ContextPlanItem[];
  phases: PlanPhase[];
  sourceSkillIds: string[];
  state: PlanState;
  /** The plan's summary when it described the plan (see `readPlanSummary`). */
  summary: PlanSummary | null;
  /** Today's session when the change was made; null when it wasn't built yet. */
  todaySession: DaySessionSnapshot | null;
};

/** The plan in a context, with today's session, as a snapshot stores it (see `PlanSnapshot`). */
function toPlanSnapshot({
  context,
  todaySession,
}: {
  context: PlanContext;
  todaySession: DaySessionSnapshot | null;
}) {
  return {
    coveredShare: context.plan.coveredShare,
    estimateHours: context.plan.estimateHours,
    inputsKey: context.plan.inputsKey,
    items: context.items.map((item) => ({
      chapterId: item.chapterId,
      completedAt: item.completedAt?.toISOString() ?? null,
      facts: readSelectedItemFacts(item.facts),
      id: item.id,
      kind: item.kind,
      lessonId: item.lessonId,
      lessons: item.lessons ?? null,
      minutes: item.minutes ?? null,
      phase: item.phase,
      scheduledFor: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
      skillId: item.skillId,
      status: item.status,
      titleSnapshot: item.titleSnapshot,
    })),
    phases: context.phases,
    sourceSkillIds: context.plan.sourceSkillIds,
    state: context.state,
    summary: planSummarySchema.safeParse(context.plan.summary).data ?? null,
    todaySession,
  };
}

/**
 * Keeps the plan in a context, with today's session as the learner has it, for the undo of the
 * change being saved with it (see `PlanSnapshot`). Call it in the change's transaction, before
 * today's session follows the change.
 */
export async function savePlanSnapshot({
  changeId,
  context,
  tx,
}: {
  changeId: string;
  context: PlanContext;
  tx: TransactionClient;
}): Promise<void> {
  const todaySession = await captureDaySession({
    goalId: context.goal.id,
    localDate: context.today,
    tx,
    userId: context.goal.userId,
  });

  await tx.planChangeSnapshot.create({
    data: { changeId, plan: toPlanSnapshot({ context, todaySession }) },
  });
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
