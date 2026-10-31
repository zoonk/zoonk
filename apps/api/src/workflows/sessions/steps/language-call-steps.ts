import { type CallWriting } from "@zoonk/core/language/conversations/call-writing";
import { listLanguageCallWritings } from "@zoonk/core/language/conversations/prepare";
import { start } from "workflow/api";
import { callContentWorkflow } from "../../calls/call-content-workflow";
import { startAll } from "../../goals/goal-outlines";

type LearnerGoal = { goalId: string; userId: string };

async function listLanguageCallWritingsStep(input: LearnerGoal): Promise<CallWriting[]> {
  "use step";

  return listLanguageCallWritings(input);
}

/** Each call is its own run on its writing's key, so a learner who taps Start joins it. */
export async function writeLanguageCalls(input: LearnerGoal): Promise<void> {
  const writings = await listLanguageCallWritingsStep(input);
  await startAll(writings.map((writing) => start(callContentWorkflow, [writing])));
}
