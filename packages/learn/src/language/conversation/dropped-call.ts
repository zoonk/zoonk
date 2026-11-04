import { type LiveCallError } from "./live-call-lifecycle";
import { type LiveCallPhase } from "./use-call-controls";
import { type MicrophoneProblem } from "./use-call-microphone";

/**
 * What the dropped screen shows: why the call can't go on (null keeps the plain "call dropped"
 * line) and how the learner can call again, if that can work. Ending the call is always there.
 */
export type DroppedCall = {
  reason:
    | "callInProgress"
    | "callsPaused"
    | "ended"
    | "limit"
    | "microphone"
    | "plusRequired"
    | null;
  retry: "callAgain" | "microphone" | "takeover" | null;
};

const BY_ERROR: Record<LiveCallError, DroppedCall> = {
  callInProgress: { reason: "callInProgress", retry: "takeover" },
  callsPaused: { reason: "callsPaused", retry: "callAgain" },
  connect: { reason: null, retry: "callAgain" },
  dropped: { reason: null, retry: "callAgain" },
  ended: { reason: "ended", retry: null },
  limit: { reason: "limit", retry: null },
  plusRequired: { reason: "plusRequired", retry: null },
};

/**
 * Null when the screen isn't a dropped call. A call that dropped stays dropped whatever stops its
 * reconnect (`continuing`), so it can still be ended and saved.
 */
export function getDroppedCall({
  continuing,
  error,
  microphoneProblem,
  phase,
}: {
  continuing: boolean;
  error: LiveCallError | null;
  microphoneProblem: MicrophoneProblem | null;
  phase: LiveCallPhase;
}): DroppedCall | null {
  if (continuing && phase === "idle" && microphoneProblem) {
    return { reason: "microphone", retry: "microphone" };
  }

  if (phase !== "failed" || !(continuing || error === "dropped")) {
    return null;
  }

  return BY_ERROR[error ?? "dropped"];
}
