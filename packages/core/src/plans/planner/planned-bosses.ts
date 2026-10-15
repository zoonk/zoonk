import { logError } from "@zoonk/utils/logger";
import { type BossBankFacts } from "../../checkpoints/checkpoint-minutes";
import { type ItemSkillRows } from "../../learner/_utils/goal-plan-projection";
import { type BossFallback, type SettlingPlan, settleTeachingFirst } from "./boss-fallback";
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
import {
  type ExamBossDays,
  isSameBossDays,
  keepLaterBossDays,
  placeExamBosses,
} from "./exam-boss-days";
import { type TestedTeaching, isSameTeaching, listTestedTeaching } from "./kept-teaching";
import { type PlanSettings } from "./plan-state";

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

function isSameMinutes(first: BossMinutes, second: BossMinutes): boolean {
  return (
    first.size === second.size &&
    [...first].every(([key, minutes]) => second.has(key) && second.get(key) === minutes)
  );
}

/**
 * Whether a pass places its challenges where the pass before did: none to place, the same, and
 * testing the same lessons there. Once passes take turns, the same days hold: what each tests then
 * follows from the later days kept.
 */
function isSameDays({
  cycling = false,
  first,
  second,
}: {
  cycling?: boolean;
  first?: ExamBossDays;
  second?: ExamBossDays;
}): boolean {
  if (!first || !second) {
    return true;
  }

  return cycling ? isSameDates(first, second) : isSameBossDays(first, second);
}

/** Whether a pass places its challenges where an earlier pass than the last did: they take turns. */
function isCycle({
  current,
  next,
  seen,
}: {
  current?: ExamBossDays;
  next?: ExamBossDays;
  seen: readonly ExamBossDays[];
}): boolean {
  return Boolean(
    current &&
    next &&
    !isSameDates(next, current) &&
    seen.some((earlier) => isSameDates(next, earlier)),
  );
}

/** Whether two passes put each challenge on the same day, beside or leading it, whatever it tests. */
function isSameDates(first: ExamBossDays, second: ExamBossDays): boolean {
  return (
    first.size === second.size &&
    [...first].every(([key, day]) => {
      const other = second.get(key);
      return other?.date === day.date && other.beside === day.beside;
    })
  );
}

/** The later of each challenge's two days (see `keepLaterBossDays`), once passes take turns. */
function keepLater({
  earlier,
  placed,
}: {
  earlier?: ExamBossDays;
  placed?: ExamBossDays;
}): ExamBossDays | undefined {
  return earlier && placed ? keepLaterBossDays({ earlier, placed }) : placed;
}

/**
 * Whether a pass holds, with what the next pass would keep from mocks' funding (`testedTeaching`,
 * see `listTestedTeaching`): its challenges' minutes and days are the ones it was built with, and
 * that teaching is on the days it was built keeping (`kept`, see `isSameTeaching`). Same days and
 * minutes alone don't settle a plan whose next pass would keep other days from its mocks' funding.
 */
function checkPass({
  built,
  days,
  kept,
  minutes,
  today,
}: {
  built: Parameters<typeof listTestedTeaching>[0]["built"];
  days: { current?: ExamBossDays; cycling: boolean; placed?: ExamBossDays };
  kept?: TestedTeaching;
  minutes: { current: BossMinutes; sized: BossMinutes };
  today: Date;
}): { holds: boolean; testedTeaching?: TestedTeaching } {
  const testedTeaching = days.placed && listTestedTeaching({ built, placed: days.placed, today });

  const holds =
    isSameMinutes(minutes.sized, minutes.current) &&
    isSameDays({ cycling: days.cycling, first: days.placed, second: days.current }) &&
    isSameTeaching(testedTeaching, kept);

  return { holds, testedTeaching };
}

/** What the passes so far say of their challenges' days (see `placePass`). */
type DayTrack = { cycledAt?: number; cycling: boolean; retried: boolean; seen: ExamBossDays[] };

/**
 * Where a pass places an exam's challenges, from their windows' ends on its layout (`placing`), and
 * where they go (`placed`): passes taking turns (a challenge's own time pushing the lessons it
 * tests, then freeing them) settle by keeping the later day from then on (see `keepLaterBossDays`).
 */
function placePass<T>({
  built,
  current,
  place,
  track,
}: {
  built: T;
  current?: ExamBossDays;
  place: (built: T) => ExamBossDays;
  track: DayTrack;
}): { placed?: ExamBossDays; placing?: ExamBossDays } {
  const placing = current && place(built);
  track.cycling ||= isCycle({ current, next: placing, seen: track.seen });
  track.cycledAt ??= track.cycling ? track.seen.length + 1 : undefined;

  return {
    placed: track.cycling ? keepLater({ earlier: current, placed: placing }) : placing,
    placing,
  };
}

/** The days the next pass tries: the placement's own once, when a pass holds on later ones. */
function getNextDays({
  holds,
  placed,
  placing,
  retried,
}: {
  holds: boolean;
  placed?: ExamBossDays;
  placing?: ExamBossDays;
  retried: boolean;
}): ExamBossDays | undefined {
  return holds && !retried && !isSameDays({ first: placing, second: placed }) ? placing : placed;
}

/** Passes beyond one per boss: one to settle what they ask, one to see it hold. */
const SETTLING_PASSES = 2;

/**
 * Plans with the time each boss runs: what a boss asks depends on the lessons before its day, which
 * depend on the time the plan keeps for the bosses, so the plan is built again with what its
 * bosses run until that holds. Past one pass per boss, and the two that settle it, its teaching is
 * kept as a build with every boss taking no time lays it, and the bosses placed after it (see
 * `settleTeachingFirst`): a Plan never fails to open. Without the facts (`bossFacts`) every boss
 * takes its size before the bank is read (see `getPlannedBossMinutes`).
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

  // What the plan saves of its checkpoints' days, so each asks for the time they take past it.
  const settled = (bossMinutes: BossMinutes, built: T, bossSizes: BossSizes = new Map()) => ({
    bossSizes,
    ...built,
    checkpointOverflow: listCheckpointOverflow({ bossMinutes, built, input }),
  });

  if (!facts && input.goal.kind !== "exam") {
    return settled(input.bossMinutes ?? new Map(), build(input));
  }

  // An exam's challenges go after the lessons they test (see `placeExamBosses`): its first pass has
  // none, and each pass places them where the last one's lessons end.
  const placesDays = input.goal.kind === "exam" && input.goal.targetDate !== null;
  let minutes: BossMinutes = input.bossMinutes ?? new Map();
  let bossDays: ExamBossDays | undefined = placesDays ? (input.bossDays ?? new Map()) : undefined;
  let built = build({ ...input, bossDays, bossMinutes: minutes });
  let limit = SETTLING_PASSES;
  const track: DayTrack = { cycling: false, retried: false, seen: [] };
  let kept: TestedTeaching | undefined;

  const placeBosses = (on: T) =>
    placeExamBosses({ built: on, input, rows: facts?.rows, survivors: facts?.survivors });

  for (let pass = 1; ; pass += 1) {
    const { minutes: sized, sizes } = readBossSizes({ built, facts, input, minutes });

    const { placed, placing } = placePass({ built, current: bossDays, place: placeBosses, track });

    // Once passes take turns, the later days they keep rise at most once per challenge from there.
    limit = Math.max(
      limit,
      (track.cycledAt ?? 0) +
        built.items.filter((item) => item.kind === "boss").length +
        SETTLING_PASSES,
    );

    const { holds, testedTeaching } = checkPass({
      built,
      days: { current: bossDays, cycling: track.cycling, placed },
      kept,
      minutes: { current: minutes, sized },
      today: input.today,
    });

    const next = getNextDays({ holds, placed, placing, retried: track.retried });

    if (holds && next === placed) {
      return settled(minutes, built, sizes);
    }

    if (pass > limit) {
      const asSized = minutes;

      // For the team, never a learner: the plan opens all the same.
      logError("Plan bosses placed after unsettled passes", {
        goalId: input.goalId ?? null,
        iterations: pass,
        reason: "unsettled",
      });

      return withBossSizes({
        built: settleTeachingFirst({
          bossDays: placed,
          build,
          input,
          iterations: pass,
          places: placed ? (taught) => placeBosses(taught) : null,
          size: (taught, items) =>
            facts
              ? toBossMinutes(
                  sizeBosses({ facts, input, items, skillLessons: taught.skillLessons }),
                )
              : asSized,
        }),
        facts,
        input,
      });
    }

    minutes = sized;
    track.seen.push(...(bossDays ? [bossDays] : []));
    track.retried ||= next !== placed;
    bossDays = next;

    // Each pass keeps from mocks' funding what its challenges test as this one laid it out.
    kept = testedTeaching;
    built = build({ ...input, bossDays, bossMinutes: minutes, testedTeaching });
  }
}
