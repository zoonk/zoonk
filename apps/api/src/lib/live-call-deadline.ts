import { liveCallDeadlineWorkflow } from "@/workflows/calls/live-call-deadline-workflow";
import { start } from "workflow/api";

/** Started before Connect answers, so the server hangs the call up on time. */
export function scheduleLiveCallDeadline(input: { connectionId: string; deadlineAt: Date }) {
  return start(liveCallDeadlineWorkflow, [input]);
}
