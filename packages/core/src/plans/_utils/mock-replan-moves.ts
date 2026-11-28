import "server-only";
import { prisma } from "@zoonk/db";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { getItemKey } from "../planner/plan-items";
import { type PlanState } from "../planner/plan-state";
import { type MockMiss } from "../planner/skill-order";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";

const MOVED_TOPICS_NAMED = 3;

type DatedItem = Pick<
  PlanContext["items"][number],
  "kind" | "lessonId" | "scheduledFor" | "skillId" | "status"
>;

async function loadTaughtSkills({
  items,
  skillIds,
}: {
  items: readonly DatedItem[];
  skillIds: readonly string[];
}): Promise<Map<string, string[]>> {
  const lessonIds = [...new Set(items.flatMap((item) => item.lessonId ?? []))];

  const taught = await prisma.lessonSkill.findMany({
    select: { lessonId: true, skillId: true },
    where: { lessonId: { in: lessonIds }, skillId: { in: [...skillIds] } },
  });

  return new Map(
    [...Map.groupBy(taught, (row) => row.lessonId)].map(([lessonId, rows]) => [
      lessonId,
      rows.map((row) => row.skillId),
    ]),
  );
}

type Placement = { day: number; position: number };

function comparePlacement(first: Placement, second: Placement): number {
  return first.day === second.day ? first.position - second.position : first.day - second.day;
}

function getFirstPlacements({
  items,
  misses,
  taught,
}: {
  items: readonly DatedItem[];
  misses: ReadonlyMap<string, MockMiss>;
  taught: ReadonlyMap<string, readonly string[]>;
}): Map<string, Placement> {
  return items.reduce((first, item, position) => {
    if (item.status !== "todo" || !LEARN_KINDS.has(item.kind)) {
      return first;
    }

    const skillIds = item.lessonId
      ? (taught.get(item.lessonId) ?? [])
      : [item.skillId ?? ""].filter((skillId) => misses.has(skillId));

    const placement = { day: item.scheduledFor?.getTime() ?? Infinity, position };

    for (const skillId of skillIds) {
      const previous = first.get(skillId);

      if (!previous || comparePlacement(placement, previous) < 0) {
        first.set(skillId, placement);
      }
    }

    return first;
  }, new Map<string, Placement>());
}

export function changedSchedule(context: PlanContext, computed: ComputedPlan): boolean {
  const after = computed.built.items;

  return (
    context.items.length !== after.length ||
    after.some((item, position) => {
      const previous = context.items[position];

      return (
        !previous ||
        getItemKey(item) !== getItemKey(previous) ||
        item.scheduledFor?.getTime() !== previous.scheduledFor?.getTime()
      );
    })
  );
}

export async function listEarlierMissedTopics({
  after,
  before,
  misses,
  state,
}: {
  after: readonly DatedItem[];
  before: readonly DatedItem[];
  misses: ReadonlyMap<string, MockMiss>;
  state: PlanState;
}): Promise<string[]> {
  const taught = await loadTaughtSkills({
    items: [...before, ...after],
    skillIds: [...misses.keys()],
  });

  const wasFirst = getFirstPlacements({ items: before, misses, taught });

  const moved = [...getFirstPlacements({ items: after, misses, taught })]
    .filter(([skillId, at]) => {
      const previous = wasFirst.get(skillId);
      return previous ? comparePlacement(at, previous) < 0 : Number.isFinite(at.day);
    })
    .toSorted(([, first], [, second]) => comparePlacement(first, second));

  const names = new Map(state.graph.skills.map((skill) => [skill.skillId, skill.name]));

  return moved.flatMap(([skillId]) => names.get(skillId) ?? []).slice(0, MOVED_TOPICS_NAMED);
}
