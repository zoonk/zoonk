import { addDays, toIsoDate } from "../../planner/plan-calendar";
import { computeSavedSimChange } from "./sim-change";
import { type SimViolation } from "./sim-context";
import { createSimPlan } from "./sim-create";
import { loadSimInputs } from "./sim-inputs";
import { type SimLife, type SimLifeStep } from "./sim-life-plan";
import { toOperations } from "./sim-operations";
import { runPlacement } from "./sim-placement";
import { commitSimPlan, computeSimPlan } from "./sim-planner";
import { refreshSimPlan } from "./sim-refresh";
import { type Runner, type SimCheck, record, refresh, startRunner } from "./sim-runner";
import { buildSimSession, findSessionDuels } from "./sim-session";
import { openToday } from "./sim-today";
import { atNoon } from "./sim-world";

async function runStudy(
  runner: Runner,
  step: Extract<SimLifeStep, { kind: "study" }>,
  index: number,
) {
  await openToday(runner, index);

  const { world } = runner;
  const day = toIsoDate(world.today);
  const session = world.sessions.get(day);

  // The learner plays the session in its order, where lessons that joined it after it was built
  // (a stand-in's, landed since) come last, wherever the plan puts them.
  const given = (session?.lessons ?? []).flatMap((lessonId) =>
    world.plan.items.filter((item) => item.status === "todo" && item.lessonId === lessonId),
  );

  // The fixtures have no questions: each of the day's duels is won as finishing it records it.
  const bosses =
    given.length === 0 && step.finish > 0 ? findSessionDuels({ start: runner.start, world }) : [];

  const lessons = given.slice(0, Math.round(given.length * step.finish));
  const finished = new Set([...lessons, ...bosses].map((item) => item.id));

  // The learner's pace counts the lessons they played (`loadOwnSample`), not a boss's duel.
  runner.own.count += lessons.length;

  runner.world = {
    ...world,
    learner: { ...world.learner, own: runner.own.count > 0 ? { ...runner.own } : null },
  };

  const items = world.plan.items.map((item) =>
    finished.has(item.id)
      ? { ...item, completedAt: atNoon(world.today), status: "done" as const }
      : item,
  );

  runner.world = { ...runner.world, plan: { ...world.plan, items } };

  // A session whose blocks are all done completes, and its end re-plans at the learner's pace
  // (`settleSessionDay`); one stopped halfway, or before the duel its lessons came first for,
  // leaves the plan as it is.
  const completed =
    bosses.length > 0 ||
    (given.length > 0 && finished.size === given.length && !session?.duels.length);

  const settled = completed ? refreshSimPlan({ pace: "sampled", world: runner.world }) : null;

  record(runner, {
    before: world.plan,
    change: settled?.change ?? null,
    event: { kind: "session" },
    label: "session",
    plan: settled?.plan ?? runner.world.plan,
    step: index,
  });

  runner.world = { ...runner.world, today: addDays(runner.world.today, 1) };
}

async function runChange(
  runner: Runner,
  step: Extract<SimLifeStep, { kind: "change" }>,
  index: number,
) {
  if (!runner.world.sessions.has(toIsoDate(runner.world.today))) {
    await openToday(runner, index);
  }

  const { world } = runner;

  const operations = toOperations({
    listBases: () => computeSimPlan({ mode: "forced", world }).bases.bases,
    spec: step.spec,
  });

  if (!operations) {
    return;
  }

  const result = computeSavedSimChange({ operations, world });

  if (!result) {
    return;
  }

  if (result.status === "saved") {
    runner.world = {
      ...world,
      plan: { ...world.plan, state: { ...world.plan.state, settings: result.settings } },
    };

    return;
  }

  record(runner, {
    before: world.plan,
    change: { day: toIsoDate(world.today), kind: "edited", operations, status: "applied" },
    event: { kind: "learnerChange", operations },
    label: "change",
    plan: commitSimPlan({ computed: result.computed, world }),
    step: index,
  });

  // Today's session follows a change the learner made (`followPlanToday`).
  const session = buildSimSession({ start: runner.start, world: runner.world });
  runner.world.sessions.set(toIsoDate(world.today), session);
}

async function runStep(runner: Runner, step: SimLifeStep, index: number): Promise<void> {
  switch (step.kind) {
    case "placement":
      runPlacement(runner, step, index);
      return;
    case "study":
      return runStudy(runner, step, index);
    case "miss":
      runner.world = { ...runner.world, today: addDays(runner.world.today, step.days) };
      return;
    case "refresh":
      await openToday(runner, index);

      // A full system run (a landing for other goals, the lookahead).
      refresh(runner, { event: { kind: "refresh" }, label: "refresh", pace: "saved", step: index });

      return;
    case "change":
      return runChange(runner, step, index);
    default:
      return step satisfies never;
  }
}

/**
 * Lives a simulated learner's life through the real planner and checks the supplied rule after
 * each thing that happens. The library's inputs are loaded once; steps use no database or AI.
 */
export async function runSimLife(
  life: SimLife,
  { check }: { check: SimCheck },
): Promise<{ violations: SimViolation[] }> {
  const inputs = await loadSimInputs(life.fixture);
  const runner = await startRunner({ check, inputs, life });

  record(runner, {
    before: null,
    change: null,
    event: { kind: "planCreated" },
    label: "create",
    plan: createSimPlan(runner.world),
    step: -1,
  });

  // Each step reads the world the one before left.
  await life.steps.reduce(
    (previous, step, index) => previous.then(() => runStep(runner, step, index)),
    Promise.resolve(),
  );

  return { violations: runner.violations };
}
