import { type ChallengeWalk, walkChallenge } from "@zoonk/core/library/challenges/graph";
import { type LessonPlayerAnswer, type PlayableLibraryStep } from "../lesson-player-types";

type ChallengeStep = Extract<PlayableLibraryStep, { kind: "challenge" }>;

type DecidingWalk = Extract<ChallengeWalk, { status: "deciding" }>;
type EndedWalk = Extract<ChallengeWalk, { status: "ended" }>;

/**
 * Where a challenge stands. `shown` counts what's on screen: 0 is the intro, and each confirmed
 * decision shows one more. The answer holds the confirmed picks plus, while deciding, the pick
 * waiting for Confirm.
 */
export type ChallengeProgress =
  | { stage: "intro" }
  | { confirmed: string[]; pendingChoiceId: string | null; stage: "deciding"; walk: DecidingWalk }
  | { confirmed: string[]; stage: "ended"; walk: EndedWalk };

function getPicks(answer: LessonPlayerAnswer | undefined): string[] {
  return answer?.kind === "challenge" ? answer.choiceIds : [];
}

export function getChallengeProgress({
  answer,
  shown,
  step,
}: {
  answer: LessonPlayerAnswer | undefined;
  shown: number;
  step: ChallengeStep;
}): ChallengeProgress {
  if (shown === 0) {
    return { stage: "intro" };
  }

  const picks = getPicks(answer);
  const confirmed = picks.slice(0, shown - 1);
  const walk = walkChallenge(step.content, confirmed);

  if (walk.status === "ended") {
    return { confirmed, stage: "ended", walk };
  }

  if (walk.status === "invalid") {
    return { stage: "intro" };
  }

  const pending = picks[shown - 1];
  const isOnScreen = walk.node.choices.some((choice) => choice.id === pending);

  return {
    confirmed,
    pendingChoiceId: pending && isOnScreen ? pending : null,
    stage: "deciding",
    walk,
  };
}

/** The answer after picking (or clearing) the choice for the decision on screen. */
export function pickChallengeChoice({
  choiceId,
  confirmed,
}: {
  choiceId: string | null;
  confirmed: readonly string[];
}): LessonPlayerAnswer | null {
  const choiceIds = choiceId ? [...confirmed, choiceId] : [...confirmed];
  return choiceIds.length > 0 ? { choiceIds, kind: "challenge" } : null;
}
