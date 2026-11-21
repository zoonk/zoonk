import "server-only";
import { type PlanChange, type TransactionClient, prisma } from "@zoonk/db";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
import { PlanConflictError } from "../plan-conflict";
import { type AreaTopics } from "../planner/plan-effect";
import { type PlanGraph } from "../planner/plan-state";
import {
  type PlanChangePayload,
  parsePlanChangePayload,
  toPlanChangePayload,
} from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { type PlanSnapshot, parsePlanSnapshot } from "./plan-snapshot";

export type LivingPlanBatch = {
  change: PlanChange;
  items: PlanSnapshot["items"];
  payload: PlanChangePayload;
  storedPayload: JsonObject;
  snapshot: JsonObject;
};

export async function loadLivingPlanBatch({
  context,
  day,
}: {
  context: PlanContext;
  day: string;
}): Promise<LivingPlanBatch | null> {
  const change = await prisma.planChange.findFirst({
    include: { snapshot: { select: { plan: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: {
      kind: { in: ["relearn", "testedOut"] },
      payload: { equals: day, path: ["livingPlanDay"] },
      planId: context.plan.id,
      status: "applied",
    },
  });

  const payload = parsePlanChangePayload(change?.payload);
  const snapshot = change?.snapshot?.plan;
  const items = parsePlanSnapshot(snapshot)?.items;

  return change &&
    items &&
    isJsonObject(snapshot) &&
    isJsonObject(change.payload) &&
    payload.versionAfter === context.plan.version
    ? { change, items, payload, snapshot, storedPayload: change.payload }
    : null;
}

export async function appendLivingPlanBatch({
  batch,
  kind,
  payload,
  tx,
}: {
  batch: LivingPlanBatch;
  kind?: "relearn";
  payload: Partial<PlanChangePayload>;
  tx: TransactionClient;
}): Promise<void> {
  const { count } = await tx.planChange.updateMany({
    data: { kind, payload: toPlanChangePayload({ ...batch.payload, ...payload }) },
    where: { id: batch.change.id, payload: { equals: batch.storedPayload } },
  });

  if (count === 0) {
    throw new PlanConflictError();
  }

  await tx.planChangeSnapshot.create({ data: { changeId: batch.change.id, plan: batch.snapshot } });
}

export function listChangeTopics({
  graph,
  skillIds,
}: {
  graph: PlanGraph;
  skillIds: ReadonlySet<string>;
}): AreaTopics[] {
  const byArea = Map.groupBy(
    graph.skills.filter((skill) => skillIds.has(skill.skillId)),
    (skill) => skill.area ?? "",
  );

  return [...byArea].map(([area, skills]) => ({
    area,
    topics: [...new Set(skills.map((skill) => skill.topics?.[0] ?? skill.name))],
  }));
}

export function mergeChangeTopics(...groups: (readonly AreaTopics[] | undefined)[]): AreaTopics[] {
  const byArea = Map.groupBy(
    groups.flatMap((topics) => topics ?? []),
    (entry) => entry.area,
  );

  return [...byArea].map(([area, entries]) => ({
    area,
    topics: [...new Set(entries.flatMap((entry) => entry.topics))],
  }));
}

export function latestLivingPlanChanges<T extends Pick<PlanChange, "payload">>(
  changes: readonly T[],
): T[] {
  const days = new Set<string>();

  return changes.filter((change) => {
    const day = parsePlanChangePayload(change.payload).livingPlanDay;

    if (!day) {
      return true;
    }

    if (days.has(day)) {
      return false;
    }

    days.add(day);
    return true;
  });
}
