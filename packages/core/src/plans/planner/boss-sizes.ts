import { getBossSize } from "../../checkpoints/checkpoint-minutes";
import { getBossSkillIds } from "../../checkpoints/checkpoint-rules";
import { type BossMinutes } from "./boss-minutes";
import { toBossPlan } from "./boss-plan";
import { type BuildPlanInput } from "./build-plan";
import { type PlannedItem } from "./plan-items";
import { type BossPlanFacts } from "./planned-bosses";

export type BossSizes = ReadonlyMap<
  string,
  { size: { minutes: number; questions: number } | null; skillIds: string[] }
>;

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

export function toBossMinutes(sizes: BossSizes): BossMinutes {
  return new Map([...sizes].map(([key, { size }]) => [key, size?.minutes ?? null]));
}

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
