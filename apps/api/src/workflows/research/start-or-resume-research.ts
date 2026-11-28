import { getRun, resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { startOnce, waitForRun } from "../_shared/run-token";
import { getExamCountryToken, getGoalResearchToken, researchWorkflow } from "./research-workflow";

async function nowStep(): Promise<number> {
  "use step";

  return Date.now();
}

async function isStartedSinceStep({ runId, since }: { runId: string; since: number }) {
  "use step";

  const createdAt = await getRun(runId).createdAt;
  return createdAt.getTime() >= since;
}

/** False when no run is waiting for the exam's country. */
async function wakeCountryWaitStep(goalId: string): Promise<boolean> {
  "use step";

  try {
    await resumeHook(getExamCountryToken(goalId), {});
    return true;
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      return false;
    }

    throw error;
  }
}

/**
 * Researches the goal as the learner just answered it. A run that started after the answer, or was
 * waiting for its country, reads it itself; one already researching read the goal before it, so a
 * new run follows once that one ends.
 */
export async function startOrResumeResearch(goalId: string): Promise<void> {
  const token = getGoalResearchToken(goalId);
  const since = await nowStep();
  const holder = await startOnce(researchWorkflow, [{ goalId }], token);

  if (await isStartedSinceStep({ runId: holder, since })) {
    return;
  }

  if (await wakeCountryWaitStep(goalId)) {
    return;
  }

  await waitForRun(holder);
  await startOnce(researchWorkflow, [{ goalId }], token);
}
