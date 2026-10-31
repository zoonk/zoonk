import { registerFollowUpStarter } from "@zoonk/core/follow-ups/starter";
import { start } from "workflow/api";
import { followUpsWorkflow } from "./follow-ups-workflow";

export function registerFollowUpRuns(): void {
  registerFollowUpStarter((userId) => start(followUpsWorkflow, [{ userId }]));
}
