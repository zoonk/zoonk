import { logError } from "@zoonk/utils/logger";
import { type BossBankFacts } from "../../checkpoints/checkpoint-minutes";
import { type ItemSkillRows } from "../../learner/_utils/goal-plan-projection";
import { type BossMinutes } from "./boss-minutes";
import {
  type BossSizes,
  readBossSizes,
  sizeBosses,
  toBossMinutes,
  withBossSizes,
} from "./boss-sizes";
import { type BuildPlanInput } from "./build-plan";
import { listCheckpointOverflow } from "./checkpoint-overflow";
import { placeExamBosses } from "./exam-boss-days";
import { type PlannedItem } from "./plan-items";
import { type PlanSettings } from "./plan-state";
import { type SettlingPlan, settleExamBosses } from "./teaching-first";

export type BossPlanFacts = {
  bank: BossBankFacts;
  listeningSkillIds: ReadonlySet<string>;
  rows: ItemSkillRows;
  survivors: ReadonlyMap<string, string>;
};

type BossFallback = { iterations: number; reason: "unsettled" };

function isSameMinutes(first: BossMinutes, second: BossMinutes): boolean {
  return (
    first.size === second.size &&
    [...first].every(([key, minutes]) => second.has(key) && second.get(key) === minutes)
  );
}

function listBossKeys(items: readonly PlannedItem[]): string[] {
  return items.flatMap((item) => (item.kind === "boss" ? [item.key] : []));
}

const SETTLING_PASSES = 2;

/**
 * Builds again until each boss's time holds; past one pass per boss and two more, the last build
 * stays (`bossFallback`), so a Plan always opens.
 */
export function settlePlannedBosses<T extends SettlingPlan>({
  build,
  input,
}: {
  build: (input: BuildPlanInput) => T;
  input: BuildPlanInput;
}): T & {
  bossSizes: BossSizes;
  bossFallback?: BossFallback;
  checkpointOverflow: PlanSettings["checkpointOverflow"];
} {
  const facts = input.bossFacts;
  const sizedBefore = input.bossMinutes ?? new Map();

  if (input.goal.kind === "exam" && input.goal.targetDate !== null) {
    const place = (on: T) =>
      placeExamBosses({ built: on, input, rows: facts?.rows, survivors: facts?.survivors });

    const size = (taught: T, items: readonly PlannedItem[]) =>
      facts
        ? toBossMinutes(sizeBosses({ facts, input, items, skillLessons: taught.skillLessons }))
        : sizedBefore;

    return withBossSizes({ built: settleExamBosses({ build, input, place, size }), facts, input });
  }

  let minutes: BossMinutes = sizedBefore;
  let built = build({ ...input, bossMinutes: minutes });

  for (let pass = 1; ; pass += 1) {
    const { minutes: sized, sizes } = readBossSizes({ built, facts, input, minutes });
    const settled = isSameMinutes(sized, minutes);

    if (settled || pass > listBossKeys(built.items).length + SETTLING_PASSES) {
      if (!settled) {
        logError("Plan bosses kept a size after unsettled passes", {
          goalId: input.goalId ?? null,
          iterations: pass,
          reason: "unsettled",
        });
      }

      return {
        bossSizes: sizes,
        ...built,
        checkpointOverflow: listCheckpointOverflow({ bossMinutes: minutes, built, input }),
        ...(!settled && { bossFallback: { iterations: pass, reason: "unsettled" as const } }),
      };
    }

    minutes = sized;
    built = build({ ...input, bossMinutes: minutes });
  }
}
