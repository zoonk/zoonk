import { resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { startOnce } from "../_shared/run-token";
import { getGoalResearchToken, researchWorkflow } from "./research-workflow";

/** False once the run holding the token has ended, so nothing waits for the wake. */
async function wakeResearchStep(token: string): Promise<boolean> {
  "use step";

  try {
    await resumeHook(token, {});
    return true;
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      return false;
    }

    throw error;
  }
}

/**
 * Starts the goal's research, or wakes the run already holding its token to read what the learner
 * just answered. A run that just started reads the answer itself and ignores the wake.
 */
export async function startOrResumeResearch(goalId: string): Promise<void> {
  const token = getGoalResearchToken(goalId);

  await startOnce(researchWorkflow, [{ goalId }], token);

  if (!(await wakeResearchStep(token))) {
    await startOnce(researchWorkflow, [{ goalId }], token);
  }
}
