import { type PlanOperation } from "../../plan-contract";
import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { type RuleEvent } from "../rules/rule-context";
import { computeSimChange } from "./sim-change";
import { writeLandedLessons } from "./sim-landing";
import { findWaitingProposal } from "./sim-phase-dates";
import { commitSimPlan } from "./sim-planner";
import { type Runner, record, refresh } from "./sim-runner";
import { buildSimSession, followSimPlan, listStandInSkills, shortHash } from "./sim-session";

/**
 * The pure tier's Today: the day's first look, what lands for it, and the learner's answers there
 * (see `sim-db-today.ts` for the database tier's).
 */

/**
 * What a system run is to the checks: the first planning run of a day settles the days before it
 * (a `newDay`, studied when the learner finished or tested out something of the plan on the last
 * day Today gave them a session: one they opened and left is missed), whatever started it, a
 * landing included; a later run that day is `later`.
 */
function toRunEvent(runner: Runner, later: RuleEvent): RuleEvent {
  const { plan, sessions, today } = runner.world;
  const day = toIsoDate(today);

  if (runner.ranDays.has(day)) {
    return later;
  }

  runner.ranDays.add(day);

  const lastOpened = [...sessions.keys()]
    .filter((entry) => entry < day)
    .toSorted()
    .at(-1);

  return {
    kind: "newDay",
    studied: plan.items.some(
      (item) => item.completedAt !== null && toIsoDate(item.completedAt) === lastOpened,
    ),
  };
}

/** The Library outlines skills: their lessons land and the plan takes them (a system refresh). */
export async function land(
  runner: Runner,
  { skillIds, step }: { skillIds: string[]; step: number },
) {
  const { inputs, world } = runner;
  const outlined = new Set(inputs.lessons.flatMap((lesson) => lesson.skillIds));

  const written = skillIds
    .filter((skillId) => !outlined.has(skillId))
    .flatMap((skillId) => writeLandedLessons({ library: inputs.library, skillId }));

  const pendingSkills = new Set(
    [...world.pendingSkills].filter((skillId) => !skillIds.includes(skillId)),
  );

  runner.world = {
    ...world,
    landedLessons: [...world.landedLessons, ...written],
    lessons: await inputs.loadLessons(pendingSkills),
    pendingSkills,
  };

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
  answerProposal(runner, step);
}

/**
 * The learner answers Today's proposal to move the phase dates as their life says
 * (`decidePlanChange`): applying it re-plans as their own change and today's session follows it;
 * keeping their dates only marks it declined.
 */
function answerProposal(runner: Runner, step: number) {
  const { life, world } = runner;
  const waiting = findWaitingProposal(world.changes);

  if (!life.proposals || !waiting) {
    return;
  }

  if (life.proposals === "decline") {
    const changes = world.changes.map((change) =>
      change === waiting ? { ...change, status: "declined" as const } : change,
    );

    runner.world = { ...world, changes };
    return;
  }

  const operations: PlanOperation[] = [{ kind: "fitPhaseDates" }];
  const result = computeSimChange({ operations, world });

  if (result.status !== "computed") {
    return;
  }

  record(runner, {
    baseline: commitSimPlan({ computed: result.baseline, world }),
    before: world.plan,
    change: { ...waiting, effect: result.effect, snapshot: world.plan, status: "applied" },
    event: { kind: "learnerChange", operations },
    label: "answer",
    plan: commitSimPlan({ computed: result.computed, world }),
    step,
  });

  // Today's session follows a change the learner applied (`followPlanToday`).
  const day = toIsoDate(world.today);
  runner.world.sessions.set(day, buildSimSession({ start: runner.start, world: runner.world }));
}
