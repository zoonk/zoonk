export function canHoldPhaseChallenges({
  mockOnlyDay,
  reviewDay,
}: {
  mockOnlyDay: boolean;
  reviewDay: boolean;
}): boolean {
  return !mockOnlyDay && !reviewDay;
}
