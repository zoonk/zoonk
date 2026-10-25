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
import { type PlannedItem, getItemKey } from "./plan-items";
import { type PlanSettings } from "./plan-state";
import { getBossKey } from "./plan-units";
import { type SettlingPlan, settleTeachingFirst } from "./teaching-first";

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

/** Why a plan's bosses were placed teaching first when its goal's aren't, for the warning it logs. */
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
 * Plans with the time each boss runs (see `BossMinutes`), what its session plays: read from the
 * plan's items with the facts (`bossFacts`), or, without them, its size before the bank is read
 * (see `getPlannedBossMinutes`).
 *
 * An exam's challenges go teaching first (see `settleTeachingFirst`): built once with none on any
 * day, each goes where that teaching puts it (see `placeExamBosses`; an exam without a date, where
 * its build does), taking none of the lessons' time, and runs past its day's time. Placed by the
 * time it takes, a challenge had no settled day: its time on a day reshuffled the days before it,
 * so its lessons ended after it, then before it, round and round, and the plan was built a dozen
 * times to end up teaching first anyway, with an error on every Plan view.
 *
 * Any other goal's bosses keep their time in their day: what a boss asks depends on the lessons
 * before it, which depend on the time the plan keeps for it, so the plan is built again with what
 * its bosses run until that holds. Past one pass per boss and the two that settle it, it goes
 * teaching first too (`bossFallback`): a Plan never fails to open.
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

  const size = (taught: T, items: readonly PlannedItem[]) =>
    facts
      ? toBossMinutes(sizeBosses({ facts, input, items, skillLessons: taught.skillLessons }))
      : sizedBefore;

  if (input.goal.kind === "exam") {
    const place = (on: T) =>
      placeExamBosses({ built: on, input, rows: facts?.rows, survivors: facts?.survivors });

    // Without a date, its build puts each phase's challenge after the phase's lessons.
    const bossDays =
      input.goal.targetDate === null ? undefined : place(build({ ...input, bossDays: new Map() }));

    // Every boss the plan holds takes no time: each one placed (or each phase's that teaches,
    // without a date), and those it saved, finished ones included.
    const bossKeys = new Set([
      ...(bossDays?.keys() ?? input.graph.skills.map((skill) => getBossKey(skill.phase))),
      ...input.items.flatMap((item) => (item.kind === "boss" ? [getItemKey(item)] : [])),
    ]);

    return withBossSizes({
      built: settleTeachingFirst({
        bossDays,
        bossKeys: [...bossKeys],
        build,
        input,
        places: bossDays ? place : null,
        size,
      }),
      facts,
      input,
    });
  }

  let minutes: BossMinutes = sizedBefore;
  let built = build({ ...input, bossMinutes: minutes });

  for (let pass = 1; ; pass += 1) {
    const { minutes: sized, sizes } = readBossSizes({ built, facts, input, minutes });

    if (isSameMinutes(sized, minutes)) {
      return {
        bossSizes: sizes,
        ...built,
        // What the plan saves of its checkpoints' days, so each asks for the time they take past it.
        checkpointOverflow: listCheckpointOverflow({ bossMinutes: minutes, built, input }),
      };
    }

    const bossKeys = listBossKeys(built.items);

    if (pass > bossKeys.length + SETTLING_PASSES) {
      // For the team, never a learner: the plan opens all the same.
      logError("Plan bosses placed after unsettled passes", {
        goalId: input.goalId ?? null,
        iterations: pass,
        reason: "unsettled",
      });

      return {
        ...withBossSizes({
          built: settleTeachingFirst({
            bossDays: undefined,
            bossKeys,
            build,
            input,
            places: null,
            size,
          }),
          facts,
          input,
        }),
        bossFallback: { iterations: pass, reason: "unsettled" },
      };
    }

    minutes = sized;
    built = build({ ...input, bossMinutes: minutes });
  }
}
