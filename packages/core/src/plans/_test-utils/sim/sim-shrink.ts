import { type SimViolation } from "./sim-context";
import { runSimLife } from "./sim-life";
import { type SimLife, type SimLifeStep } from "./sim-life-plan";
import { type SimCheck } from "./sim-runner";

async function violates({
  check,
  life,
  rule,
}: {
  check?: SimCheck;
  life: SimLife;
  rule: string;
}): Promise<SimViolation | null> {
  const { violations } = await runSimLife(life, check ? { check } : {});
  return violations.find((violation) => violation.rule === rule) ?? null;
}

/** The same learner leaving Today's proposals waiting and mocks' offers unanswered. */
function withoutAnswers({ mockOffers: _offer, proposals: _answer, ...rest }: SimLife): SimLife {
  return rest;
}

/** A step as it is, but never undone. */
function keepStep(step: SimLifeStep): SimLifeStep {
  if (step.kind !== "change" && step.kind !== "placement") {
    return step;
  }

  const { undo: _undo, ...kept } = step;
  return kept;
}

/** The same learner keeping every change and test-out they made. */
function withoutUndos(life: SimLife): SimLife {
  return { ...life, steps: life.steps.map((step) => keepStep(step)) };
}

/** How many lives a shrink lives at most. */
const MAX_SHRINK_RUNS = 40;

/**
 * The shortest life that still breaks `rule`: cut after the step that broke it, drop steps one at a
 * time while it still breaks, then drop what the learner brought (pending outlines, known areas).
 * Each try lives the whole life again, so it stops after `maxRuns`.
 */
export async function shrinkSimLife({
  check,
  life,
  maxRuns = MAX_SHRINK_RUNS,
  rule,
}: {
  check?: SimCheck;
  life: SimLife;
  maxRuns?: number;
  rule: string;
}): Promise<{ life: SimLife; runs: number; violation: SimViolation | null }> {
  const found = await violates({ check, life, rule });

  if (!found) {
    return { life, runs: 1, violation: null };
  }

  const state = {
    best: { ...life, steps: life.steps.slice(0, found.step + 1) },
    runs: 1,
    violation: found,
  };

  // From the last step back: dropping one never moves the steps before it.
  const drops = state.best.steps.map((_, offset) => (best: SimLife) => ({
    ...best,
    steps: best.steps.toSpliced(best.steps.length - 1 - offset, 1),
  }));

  const simplifications: Partial<SimLife>[] = [
    { pending: [] },
    { knownAreas: [] },
    { subscribed: false },
    { speed: 1 },
  ];

  const tries = [
    ...drops,
    ...simplifications.map((change) => (best: SimLife) => ({ ...best, ...change })),
    withoutAnswers,
    withoutUndos,
  ];

  // Each try starts from the shortest life kept so far.
  await tries.reduce(
    (previous, toCandidate) =>
      previous.then(async () => {
        if (state.runs >= maxRuns) {
          return;
        }

        const candidate = toCandidate(state.best);
        const violation = await violates({ check, life: candidate, rule });
        state.runs += 1;

        if (violation) {
          state.best = candidate;
          state.violation = violation;
        }
      }),
    Promise.resolve(),
  );

  return { life: state.best, runs: state.runs, violation: state.violation };
}

/** A failing test for a violation, ready to paste next to the planner code it's about. */
export function formatRepro({
  life,
  violation,
}: {
  life: SimLife;
  violation: SimViolation;
}): string {
  const title = `${violation.rule}: ${violation.message}`.replaceAll('"', "'");

  return [
    `it("${title}", async () => {`,
    `  const { violations } = await runSimLife(${JSON.stringify(life)});`,
    `  expect(violations.filter((violation) => violation.rule === "${violation.rule}")).toStrictEqual([]);`,
    "});",
  ].join("\n");
}
