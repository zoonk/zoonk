import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type HapticInput } from "web-haptics";
import { type PlayerMilestone } from "./player-context";
import { type PlayerPhase, type StepResult } from "./player-reducer";

export type PlayerHapticSnapshot = {
  phase: PlayerPhase;
  result?: StepResult;
  step?: SerializedStep | null;
};

const MILESTONE_COMPLETE_PATTERN: HapticInput = [
  { duration: 30, intensity: 0.6 },
  { delay: 45, duration: 45, intensity: 0.9 },
  { delay: 70, duration: 80, intensity: 1 },
];

/**
 * Returns the milestone completion haptic.
 *
 * Finishing an activity should feel affirmative, while finishing a lesson,
 * chapter, or course deserves a stronger celebratory pattern.
 */
function getCompletionHaptic({
  milestoneKind,
}: {
  milestoneKind: PlayerMilestone["kind"];
}): HapticInput {
  if (milestoneKind === "activity") {
    return "success";
  }

  return MILESTONE_COMPLETE_PATTERN;
}

/**
 * Maps feedback reveals to a generic tactile signal.
 * All remaining checked steps resolve to a single correct/incorrect result,
 * so the haptic layer no longer needs activity-specific interpretation.
 */
function getFeedbackRevealHaptic({ result }: { result?: StepResult }): HapticInput | null {
  if (!result) {
    return null;
  }

  return result.result.isCorrect ? "success" : "error";
}

/**
 * Computes the ordered haptic sequence for one player state transition.
 *
 * Completion takes precedence over feedback because it changes the whole
 * surface, while feedback haptics only describe the latest checked answer.
 */
export function getPlayerHapticSequence({
  current,
  milestoneKind,
  previous,
}: {
  current: PlayerHapticSnapshot;
  milestoneKind: PlayerMilestone["kind"];
  previous: PlayerHapticSnapshot;
}): HapticInput[] {
  if (previous.phase !== "completed" && current.phase === "completed") {
    return [getCompletionHaptic({ milestoneKind })];
  }

  if (previous.phase === "playing" && current.phase === "feedback") {
    const feedbackHaptic = getFeedbackRevealHaptic({ result: current.result });

    if (feedbackHaptic) {
      return [feedbackHaptic];
    }
  }

  return [];
}
