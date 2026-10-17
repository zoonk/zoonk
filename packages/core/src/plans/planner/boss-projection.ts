import { type ItemSkillRows } from "../../learner/_utils/goal-plan-projection";
import { toBossPlan } from "./boss-plan";
import { type BuildPlanInput } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import {
  EVENT_RANK,
  KEPT_RANK,
  LEADING_RANK,
  type PlannedItem,
  type RankedItem,
  UNIT_RANK,
  compareItems,
  getSortDate,
} from "./plan-items";
import { getBossKey } from "./plan-units";

/** Where a run tries an exam's phase challenge (see `placeExamBosses`): its day, beside or leading it. */
export type BossCandidate = { beside: boolean; date: string; key: string; phase: number };

const LEARN_KINDS = new Set<PlannedItem["kind"]>(["chapter", "lesson"]);

/** A place between two items in plan order, so a challenge sits right before the next one. */
const BETWEEN_ITEMS = 0.5;

/** An item's rank on its day as `mergePlanItems` gave it (kept work, lessons, then events). */
function rankItem({ item, kept }: { item: PlannedItem; kept: ReadonlySet<string> }): number {
  if (kept.has(item.key)) {
    return KEPT_RANK;
  }

  return LEARN_KINDS.has(item.kind) ? UNIT_RANK : EVENT_RANK;
}

/** A challenge as a plan item on its candidate day, the one the plan holds when it has it. */
function toBossItem({
  candidate,
  saved,
}: {
  candidate: BossCandidate;
  saved: PlannedItem | undefined;
}): PlannedItem {
  return {
    chapterId: null,
    completedAt: null,
    id: null,
    lessonId: null,
    minutes: 0,
    skillId: null,
    titleSnapshot: "",
    ...saved,
    key: candidate.key,
    kind: "boss",
    phase: candidate.phase,
    scheduledFor: fromIsoDate(candidate.date),
    status: "todo",
  };
}

/**
 * A built plan's items with the challenges a run still places (`candidates`) on their candidate
 * days, in the order the saved plan gives them (see `mergePlanItems`): each one the plan holds
 * moved there, each it doesn't hold yet added, the ones it keeps (finished, skipped, kept this
 * week) where they are. With each item's rank on its day.
 */
function projectBossItems({
  built,
  candidates,
}: {
  built: { items: readonly PlannedItem[]; keptKeys: ReadonlySet<string> };
  candidates: readonly (BossCandidate & { laid?: { beside: boolean; date: string } })[];
}): RankedItem[] {
  const moving = new Set(candidates.map((candidate) => candidate.key));
  const saved = new Map(built.items.map((item) => [item.key, item]));

  return [
    ...built.items
      .filter((item) => !moving.has(item.key))
      .map((item) => ({ item, rank: rankItem({ item, kept: built.keptKeys }) })),
    ...candidates.map((candidate) => {
      const spot = { ...candidate, ...candidate.laid };

      return {
        item: toBossItem({ candidate: spot, saved: saved.get(candidate.key) }),
        rank: spot.beside ? EVENT_RANK : LEADING_RANK,
      };
    }),
  ].toSorted(compareItems);
}

/**
 * The challenges of a built plan a run places (see `placeExamBosses`): every phase's but the final
 * stretch's and what follows the exam, which have none, unless the plan keeps it as it is
 * (finished, skipped, or kept this week). Each is placed from its window's end (`anchor`, the
 * phase end the learner was shown when the run keeps it), never from where an earlier pass or the
 * saved plan had it. While a run places the others, each reads as where its layout has it (`date`),
 * else at its anchor.
 */
export function listBossCandidates({
  built,
}: {
  built: {
    items: readonly PlannedItem[];
    keptKeys: ReadonlySet<string>;
    phases: readonly { endDate: string | null; kind?: string }[];
  };
}): (BossCandidate & { laid: { beside: boolean; date: string } })[] {
  return built.phases.flatMap((phase, index) => {
    const key = getBossKey(index);
    const saved = built.items.find((item) => item.key === key);
    const anchor = phase.kind !== "finalStretch" && phase.kind !== "afterExam" && phase.endDate;

    if (!anchor || built.keptKeys.has(key) || (saved && saved.status !== "todo")) {
      return [];
    }

    const laid = saved?.scheduledFor
      ? {
          beside: isBesideItsDay({ boss: saved, items: built.items }),
          date: toIsoDate(saved.scheduledFor),
        }
      : { beside: false, date: anchor };

    return [{ beside: false, date: anchor, key, laid, phase: index }];
  });
}

/** Whether a challenge the plan holds comes after a lesson of its own day: beside them. */
function isBesideItsDay({
  boss,
  items,
}: {
  boss: PlannedItem;
  items: readonly PlannedItem[];
}): boolean {
  const at = items.indexOf(boss);
  const day = getSortDate(boss);

  return items
    .slice(0, at)
    .some(
      (item) => getSortDate(item) === day && LEARN_KINDS.has(item.kind) && item.status === "todo",
    );
}

/**
 * A built plan as its challenges read it (see `toBossPlan`), with the ones a run places on their
 * candidate days (see `projectBossItems`): the same projection and rule (`getBossSkillIds`)
 * sizing and the session read, so what a challenge tests here is what it asks once saved. `at`
 * gives where a challenge would go on another day: leading it, or beside its lessons.
 */
export function projectBossPlan({
  built,
  candidates,
  input,
  rows,
  survivors,
}: {
  built: {
    items: readonly PlannedItem[];
    keptKeys: ReadonlySet<string>;
    skillLessons: ReadonlyMap<string, number>;
  };
  candidates: readonly (BossCandidate & { laid?: { beside: boolean; date: string } })[];
  input: Pick<BuildPlanInput, "graph" | "settings">;
  rows?: ItemSkillRows;
  survivors?: ReadonlyMap<string, string>;
}) {
  const ranked = projectBossItems({ built, candidates });

  const plan = toBossPlan({
    input,
    items: ranked.map(({ item }) => item),
    rows,
    skillLessons: built.skillLessons,
    survivors,
  });

  // The plan without one challenge, which another day of its own is tried for.
  const without = new Map(
    candidates.map((candidate) => [
      candidate.key,
      { ...plan, items: plan.items.filter((item) => item.id !== candidate.key) },
    ]),
  );

  const at = ({
    beside,
    day,
    key,
    phase,
  }: {
    beside: boolean;
    day: Date;
    key: string;
    phase: number;
  }) => {
    const rank = beside ? EVENT_RANK : LEADING_RANK;
    const time = day.getTime();

    const index = ranked.findIndex(({ item, rank: other }) => {
      const date = getSortDate(item);

      return (
        item.key !== key &&
        (date > time ||
          (date === time &&
            (other > rank || (other === rank && item.kind === "boss" && item.phase > phase))))
      );
    });

    return (index === -1 ? ranked.length : index) - BETWEEN_ITEMS;
  };

  return { at, plan, without: (key: string) => without.get(key) ?? plan };
}
