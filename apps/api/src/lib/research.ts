import "server-only";
import { startOnce } from "@/workflows/_shared/run-token";
import { type ResearchInput, researchWorkflow } from "@/workflows/research/research-workflow";
import { start } from "workflow/api";

/** A goal's own research runs once at a time; reading new uploads always starts its own run. */
export async function startResearch(input: ResearchInput): Promise<string> {
  if (input.sourceIds?.length) {
    const run = await start(researchWorkflow, [input]);
    return run.runId;
  }

  return startOnce(researchWorkflow, [input], `research-goal:${input.goalId}`);
}
