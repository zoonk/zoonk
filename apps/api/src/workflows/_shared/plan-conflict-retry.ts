import { sleep } from "workflow";
import { repeatUntil } from "./repeat-until";

const PLAN_CONFLICT_WAITS = ["5s", "15s", "45s", "2m", "2m"] as const;

export type PlanStepOutcome<T> = { conflict: false; value: T } | { conflict: true };

type Attempt<T> = { index: number; outcome: PlanStepOutcome<T> };

/** Throws once the plan still conflicts after the last wait, for the run's own failure handling. */
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
