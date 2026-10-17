import { getLearnerGeneration, getLearnerSummaryState } from "@/lib/learner/learner-store";
import { noteLearnerRevision, noteLearnerWrite } from "@/lib/learner/learner-views";
import { type OpenStudyDayInput } from "@zoonk/core/sessions/open-day-contract";
import { type TapResult } from "./day-entry";
import { type DayOpenOutcome, openStudyDayAction } from "./day-open-action";
import { type StudyDestination } from "./study-destination";

/** The learner the browser holds now, whose outcomes this tab applies. */
function getHeldUserId(): string | null {
  const state = getLearnerSummaryState();
  return state.status === "ready" ? state.summary.identity.userId : null;
}

/**
 * What a day's open came to, for the screen that tapped: where the step plays once it started, a
 * read of the screen again when nothing started (the step changed or left the day, the day had
 * nothing to open, the goal can't be studied now: the screen says which once it reads itself), or
 * a failure, which two lost races in a row are too.
 */
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

/** What a saved day's action came to: null didn't work; `changed` opened nothing on purpose. */
export function toDestinationResult(destination: StudyDestination | null): TapResult {
  if (!destination) {
    return { kind: "failed" };
  }

  return destination.kind === "changed" ? { kind: "refresh" } : { destination, kind: "go" };
}

/**
 * Tells the views what a write left: the revision an outcome carries for the learner the browser
 * holds, or else that something may have changed, so every view on screen reads itself once.
 */
function noteOutcome({ generation, outcome }: { generation: number; outcome: DayOpenOutcome }) {
  if ("actorId" in outcome) {
    if (outcome.actorId === getHeldUserId()) {
      noteLearnerRevision({ generation, revision: outcome.revision, userId: outcome.actorId });
    }

    return;
  }

  noteLearnerWrite({ generation });
}

/**
 * Opens the day the screen showed, from the learner's tap: the request leaves at once (call this in
 * the click, before navigating, so the navigation never holds it back). When it lost a race to
 * another write of the learner's (`retryable`), it's sent once more, in a request of its own, while
 * the tab is still where the tap was made for the same identity (`stillHere`); a second loss is a
 * failure.
 */
export async function sendDayOpen({
  input,
  stillHere,
}: {
  input: OpenStudyDayInput;
  stillHere: () => boolean;
}): Promise<DayOpenOutcome> {
  const generation = getLearnerGeneration();
  const first = await openStudyDayAction(input);

  const again =
    first.status === "retryable" && stillHere() && generation === getLearnerGeneration();

  const outcome = again ? await openStudyDayAction(input) : first;

  noteOutcome({ generation, outcome });
  return outcome;
}
