import { type ItemSkillRows } from "../../learner/_utils/goal-plan-projection";
import { toBossPlan } from "./boss-plan";
import { type BuildPlanInput } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { LEARN_KINDS } from "./plan-item-rules";
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

export type BossCandidate = { beside: boolean; date: string; key: string; phase: number };

const BETWEEN_ITEMS = 0.5;

function rankItem({ item, kept }: { item: PlannedItem; kept: ReadonlySet<string> }): number {
  if (kept.has(item.key)) {
    return KEPT_RANK;
  }

  return LEARN_KINDS.has(item.kind) ? UNIT_RANK : EVENT_RANK;
}

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
  input: Pick<BuildPlanInput, "goal" | "graph" | "settings">;
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
