import { sleep } from "workflow";
import { markLiveCallUnconfirmedStep, recoverLiveCallStep } from "./steps/live-call-recovery-steps";

export type LiveCallDeadlineInput = { connectionId: string; deadlineAt: Date; generation: number };

/** Five bounded close attempts share the original run and its durable timer. */
const CLOSE_BACKOFF = [null, "5s", "30s", "2m", "5m"] as const;

/** Missing confirmation keeps the slot and liability held; it never starts a replacement run. */
export async function liveCallDeadlineWorkflow(input: LiveCallDeadlineInput) {
  "use workflow";

  await sleep(input.deadlineAt);

  for (const backoff of CLOSE_BACKOFF) {
    if (backoff) {
      // oxlint-disable-next-line no-await-in-loop -- Each retry must wait before the next close attempt.
      await sleep(backoff);
    }

    // oxlint-disable-next-line no-await-in-loop -- Concurrent close attempts would bypass the backoff.
    const result = await recoverLiveCallStep(input);

    if (result.status === "notDue") {
      // oxlint-disable-next-line no-await-in-loop -- A premature wake must respect core's absolute deadline.
      await sleep(result.deadlineAt);
    } else if (result.status !== "closing") {
      return result;
    }
  }

  await markLiveCallUnconfirmedStep(input);
  return { status: "unconfirmed" as const };
}
