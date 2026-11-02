import { sleep } from "workflow";
import { endLiveCallStep } from "./steps/end-live-call-step";

export async function liveCallDeadlineWorkflow(input: { connectionId: string; deadlineAt: Date }) {
  "use workflow";

  await sleep(input.deadlineAt);
  await endLiveCallStep({ connectionId: input.connectionId, reason: "deadline" });
}
