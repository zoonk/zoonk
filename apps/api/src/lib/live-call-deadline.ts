import { liveCallDeadlineWorkflow } from "@/workflows/v2/calls/live-call-deadline-workflow";
import { start } from "workflow/api";

/** Started before Connect answers, so the server hangs the call up on time. */
export function scheduleLiveCallDeadline(input: { connectionId: string; deadlineAt: Date }) {
  return start(liveCallDeadlineWorkflow, [input]);
}
