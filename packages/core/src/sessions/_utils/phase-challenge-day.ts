import { isPhaseChallenge } from "../../checkpoints/_utils/challenge-reach";
import { type SessionBuildInput } from "../session-builder";
import { fundLeadingChallenges, getLeadingChallenges } from "./day-stretch";
import { isSessionReviewDay } from "./session-lessons";

export function canHoldPhaseChallenges({
  mockOnlyDay,
  reviewDay,
}: {
  mockOnlyDay: boolean;
  reviewDay: boolean;
}): boolean {
  return !mockOnlyDay && !reviewDay;
}

export function fundSessionChallenges(input: SessionBuildInput, budget: number) {
  const planItems = input.planItems ?? [];

  const available = canHoldPhaseChallenges({
    mockOnlyDay: false,
    reviewDay: isSessionReviewDay(input),
  })
    ? input.checkpoints.filter((checkpoint) => isPhaseChallenge(checkpoint))
    : [];

  const leading = fundLeadingChallenges({
    budget,
    checkpoints: getLeadingChallenges({ checkpoints: available, items: planItems }),
    overflow: !input.usedMinutes,
  });

  const calendar = input.checkpoints.filter((checkpoint) => !isPhaseChallenge(checkpoint));
  return { available, calendar, checkpoints: [...leading, ...calendar], leading, planItems };
}
