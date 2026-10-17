import { sleep } from "workflow";
import { repeatUntil } from "./repeat-until";

/**
 * The durable waits between the attempts of a step that plans a goal and lost to other writes of
 * the plan: each longer than the one before, about five minutes in all, so the burst of lessons
 * and questions other runs save ends first.
 */
const PLAN_CONFLICT_WAITS = ["5s", "15s", "45s", "2m", "2m"] as const;

/** What a step that plans a goal ended with: its result, or a plan that kept changing. */
export type PlanStepOutcome<T> = { conflict: false; value: T } | { conflict: true };

type Attempt<T> = { index: number; outcome: PlanStepOutcome<T> };

/**
 * Runs a step that plans a goal until it saves its plan: one that lost to other writes of the plan
 * (see `catchPlanConflict`) runs again after a durable wait (see `PLAN_CONFLICT_WAITS`), six times
 * in all, then throws, for the run's own failure handling. The step's other errors keep the
 * runtime's own retries.
 */
export async function retryPlanConflicts<Input, T>(
  step: (input: Input) => Promise<PlanStepOutcome<T>>,
  input: Input,
): Promise<T> {
  const run = () => step(input);

  const last = await repeatUntil<Attempt<T>>({
    done: ({ outcome }) => !outcome.conflict,
    run: async (previous) => {
      if (!previous) {
        return { index: 0, outcome: await run() };
      }

      await sleep(PLAN_CONFLICT_WAITS[previous.index] ?? "2m");
      return { index: previous.index + 1, outcome: await run() };
    },
    times: PLAN_CONFLICT_WAITS.length + 1,
  });

  if (last.outcome.conflict) {
    throw new Error("The plan kept changing while it was planned, through every attempt.");
  }

  return last.outcome.value;
}
