import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { type RuleEvent } from "../rules/rule-context";
import { type Runner, refresh } from "./sim-runner";
import { buildSimSession, followSimPlan, listStandInSkills, shortHash } from "./sim-session";

/** The simulator's Today: the day's first look, and what lands for it. */

/**
 * What a system run is to the checks: the first planning run of a day settles the days before it
 * (a `newDay`), whatever started it, a landing included; a later run that day is `later`.
 */
function toRunEvent(runner: Runner, later: RuleEvent): RuleEvent {
  const day = toIsoDate(runner.world.today);

  if (runner.ranDays.has(day)) {
    return later;
  }

  runner.ranDays.add(day);
  return { kind: "newDay" };
}

/** The Library outlines skills: their lessons land and the plan takes them (a system refresh). */
async function land(runner: Runner, { skillIds, step }: { skillIds: string[]; step: number }) {
  const { inputs, world } = runner;

  const pendingSkills = new Set(
    [...world.pendingSkills].filter((skillId) => !skillIds.includes(skillId)),
  );

  runner.world = { ...world, lessons: await inputs.loadLessons(pendingSkills), pendingSkills };

  refresh(runner, {
    event: toRunEvent(runner, { kind: "outlinesLanded" }),
    label: "land",
    pace: "saved",
    step,
  });
}

/**
 * The day's first look at Today: what the Library outlined ahead lands, the day settles and its
 * session is built. A later look the same day reads the session as built, with the lessons a plan
 * changed since then adds at its end (`refreshDayFromPlan`).
 */
export async function openToday(runner: Runner, step: number) {
  const { life, world } = runner;
  const day = toIsoDate(world.today);
  const session = world.sessions.get(day);

  if (session) {
    world.sessions.set(day, followSimPlan({ session, start: runner.start, world }));
    return;
  }

  // The Library outlines what the plan needs soon ahead of time; now and then it's late.
  const soon = listStandInSkills({
    items: world.plan.items,
    until: addDays(world.today, 2),
  }).filter(
    (skillId) => shortHash(`${life.seed}:${runner.inputs.library.short(skillId)}`) % 10 !== 0,
  );

  if (soon.length > 0) {
    await land(runner, { skillIds: soon, step });
  }

  refresh(runner, {
    event: toRunEvent(runner, { kind: "refresh" }),
    label: "open",
    pace: "saved",
    settleOnly: true,
    step,
  });

  runner.world.sessions.set(day, buildSimSession({ start: runner.start, world: runner.world }));
}
