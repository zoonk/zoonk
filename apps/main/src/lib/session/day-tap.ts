import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { getLearnerGeneration } from "@/lib/learner/learner-store";
import { type OpenStudyDayInput } from "@zoonk/core/sessions/open-day-contract";
import { type TapResult } from "./day-entry";
import { type DayOpenOutcome, openStudyDayAction } from "./day-open-action";
import { type StudyDestination } from "./study-destination";

export function toTapResult(outcome: DayOpenOutcome): TapResult {
  if (outcome.status === "opened") {
    return outcome.destination
      ? { destination: outcome.destination, kind: "go" }
      : { kind: "refresh" };
  }

  return outcome.status === "failed" || outcome.status === "retryable"
    ? { kind: "failed" }
    : { kind: "refresh" };
}

/** `changed` opened nothing on purpose. */
export function toDestinationResult(destination: StudyDestination | null): TapResult {
  if (!destination) {
    return { kind: "failed" };
  }

  return destination.kind === "changed" ? { kind: "refresh" } : { destination, kind: "go" };
}

/**
 * Call this in the click, before navigating, so the navigation never holds the request back. A lost
 * race is sent once more while the tab is still where the tap was made; a second loss is a failure.
 */
export async function sendDayOpen({
  input,
  stillHere,
}: {
  input: OpenStudyDayInput;
  stillHere: () => boolean;
}): Promise<DayOpenOutcome> {
  const generation = getLearnerGeneration();
  const first = await noteAppWrite(openStudyDayAction(input));

  const again =
    first.status === "retryable" && stillHere() && generation === getLearnerGeneration();

  return again ? noteAppWrite(openStudyDayAction(input)) : first;
}
