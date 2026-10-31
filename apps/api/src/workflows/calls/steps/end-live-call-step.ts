import { endLiveCall } from "@zoonk/core/language/conversations/end-live-call";
import { type LiveCallEndReason } from "@zoonk/db";

export async function endLiveCallStep(input: { connectionId: string; reason: LiveCallEndReason }) {
  "use step";

  const result = await endLiveCall(input);

  if (result.status === "closing") {
    throw new Error(`Live call ${input.connectionId} is still closing`);
  }

  return result;
}
