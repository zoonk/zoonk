import {
  type LiveCallDeadlineInput,
  liveCallDeadlineWorkflow,
} from "@/workflows/v2/calls/live-call-deadline-workflow";
import { start } from "workflow/api";

/** Core persists this enqueue receipt before making the reservation redeemable. */
export async function scheduleLiveCallDeadline(input: LiveCallDeadlineInput) {
  const run = await start(liveCallDeadlineWorkflow, [input]);
  return { runId: run.runId };
}
