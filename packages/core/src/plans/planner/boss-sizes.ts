import { getBossSize } from "../../checkpoints/checkpoint-minutes";
import { getBossSkillIds } from "../../checkpoints/checkpoint-rules";
import { type BossMinutes } from "./boss-minutes";
import { toBossPlan } from "./boss-plan";
import { type BuildPlanInput } from "./build-plan";
import { type PlannedItem } from "./plan-items";
import { type BossPlanFacts } from "./planned-bosses";

/**
 * What each of a plan's bosses runs, by its key: the skills its session asks and its size, null
 * for one that can't be asked yet (see `getBossSize`).
 */
export type BossSizes = ReadonlyMap<
  string,
  { size: { minutes: number; questions: number } | null; skillIds: string[] }
>;

/**
 * What each of a built plan's bosses runs (see `BossSizes`): the skills its session asks, read from
 * the plan as it would be saved (`getBossSkillIds` over the items' skills as `loadGoalPlan` reads
 * them, without the areas the learner took out), and what the bank holds for them (`getBossSize`).
 */
export function sizeBosses({
  facts,
  input,
  items,
  skillLessons,
}: {
  facts: BossPlanFacts;
  input: BuildPlanInput;
  items: readonly PlannedItem[];
  skillLessons: ReadonlyMap<string, number>;
}): BossSizes {
  const plan = toBossPlan({
    input,
    items,
    rows: facts.rows,
    skillLessons,
    survivors: facts.survivors,
  });

  return new Map(
    plan.items
      .filter((item) => item.kind === "boss")
      .map((boss) => {
        const skillIds = getBossSkillIds({ ...plan, boss });

        const size = getBossSize({
          facts: facts.bank,
          goalKind: input.goal.kind,
          listeningSkillIds: facts.listeningSkillIds,
          skillIds,
        });

        return [boss.key, { size, skillIds }] as const;
      }),
  );
}

/** Each boss's minutes (see `BossMinutes`), null for one that can't be asked yet. */
export function toBossMinutes(sizes: BossSizes): BossMinutes {
  return new Map([...sizes].map(([key, { size }]) => [key, size?.minutes ?? null]));
}

/** The same canonical bank read, exposing its size facts alongside the minutes used by a pass. */
export function readBossSizes({
  built,
  facts,
  input,
  minutes,
}: {
  built: { items: readonly PlannedItem[]; skillLessons: ReadonlyMap<string, number> };
  facts: BossPlanFacts | undefined;
  input: BuildPlanInput;
  minutes: BossMinutes;
}): { minutes: BossMinutes; sizes: BossSizes } {
  const sizes = facts ? sizeBosses({ facts, input, ...built }) : new Map();
  return { minutes: facts ? toBossMinutes(sizes) : minutes, sizes };
}

/** Adds observational facts to the emergency result without changing its allocation or acceptance. */
export function withBossSizes<
  T extends { items: readonly PlannedItem[]; skillLessons: ReadonlyMap<string, number> },
>({
  built,
  facts,
  input,
}: {
  built: T;
  facts: BossPlanFacts | undefined;
  input: BuildPlanInput;
}): T & { bossSizes: BossSizes } {
  return { ...built, bossSizes: facts ? sizeBosses({ facts, input, ...built }) : new Map() };
}
