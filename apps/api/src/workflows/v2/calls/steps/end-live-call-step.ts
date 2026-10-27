import { endLiveCall } from "@zoonk/core/language/conversations/end-live-call";
import { type LiveCallEndReason } from "@zoonk/db";

/**
 * Ends the connection and settles it. A hangup OpenAI didn't confirm throws, so the step's own
 * retries try again; if they run out, the connection stays open, its cost keeps counting by the
 * clock, and the learner's next start or End tries once more.
 */
export async function endLiveCallStep(input: { connectionId: string; reason: LiveCallEndReason }) {
  "use step";

  const result = await endLiveCall(input);

  if (result.status === "closing") {
    throw new Error(`Live call ${input.connectionId} is still closing`);
  }

  return result;
}
