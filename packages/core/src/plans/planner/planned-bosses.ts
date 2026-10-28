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

/**
 * What a plan's bosses ask, read once for a planning run, so the plan keeps for each the time its
 * session plays it (see `settlePlannedBosses`): the question bank as the learner meets it, the
 * goal's skills heard only through recordings, the skills the Library says the run's lessons and
 * chapters teach, and each merged skill's survivor.
 */
export type BossPlanFacts = {
  bank: BossBankFacts;
  listeningSkillIds: ReadonlySet<string>;
  rows: ItemSkillRows;
  survivors: ReadonlyMap<string, string>;
};

/** Why a plan's bosses kept a size their session doesn't play, for the warning it logs. */
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

/** Passes beyond one per boss: one to settle what they ask, one to see it hold. */
const SETTLING_PASSES = 2;

/**
 * Plans with each boss inside its day (R45), at the time its session plays it (see `BossMinutes`):
 * read from the plan's items with the facts (`bossFacts`), or, without them, its size before the
 * bank is read (see `getPlannedBossMinutes`). A run starts from what the plan last saved
 * (`input.bossMinutes`), so it plans once unless what a boss asks changed.
 *
 * A dated exam's challenges go where its teaching puts them (see `settleExamBosses`). Any other
 * goal's bosses are units of its queue, after their phase's lessons: what a boss asks depends on
 * the lessons before it, which depend on the time the plan keeps for it, so the plan is built again
 * with what its bosses run until that holds. Past one pass per boss and the two that settle it,
 * the last build stays, its bosses at what they run (`bossFallback`): a Plan never fails to open.
 */
export function settlePlannedBosses<T extends SettlingPlan>({
  build,
  input,
}: {
  /** The plan built with what each boss runs (`bossMinutes`). */
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
        // For the team, never a learner: the plan opens all the same.
        logError("Plan bosses kept a size after unsettled passes", {
          goalId: input.goalId ?? null,
          iterations: pass,
          reason: "unsettled",
        });
      }

      return {
        bossSizes: sizes,
        ...built,
        // What the plan saves of its checkpoints' days, so each asks for the time they take past it.
        checkpointOverflow: listCheckpointOverflow({ bossMinutes: minutes, built, input }),
        ...(!settled && { bossFallback: { iterations: pass, reason: "unsettled" as const } }),
      };
    }

    minutes = sized;
    built = build({ ...input, bossMinutes: minutes });
  }
}
