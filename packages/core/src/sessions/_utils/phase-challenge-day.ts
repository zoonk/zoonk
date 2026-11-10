export function canHoldPhaseChallenges({
  trialEnded,
  mockOnlyDay,
  reviewDay,
}: {
  trialEnded: boolean;
  mockOnlyDay: boolean;
  reviewDay: boolean;
}): boolean {
  return !trialEnded && !mockOnlyDay && !reviewDay;
}
