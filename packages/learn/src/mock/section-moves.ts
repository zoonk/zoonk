import { type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";

/**
 * How the running section lets the learner move, as the notice says (`SectionNavigation`): a
 * forward-only section opens one question after another and never an earlier one, until the
 * review at its end (when the notice gives one), which changes only so many answers; `mustAnswer`
 * asks for an answer before moving on, and `itemSeconds` gives each question its own clock.
 */
export type SectionMoves = {
  /** Whether a question can change its answer now: one left behind can't, but in the review. */
  canChange: (position: number) => boolean;
  /** Whether a question can be opened now: the next one only, in a forward-only section. */
  canOpen: (position: number) => boolean;
  /** The answers the review may still change; null outside a review or without a limit. */
  changesLeft: number | null;
  forwardOnly: boolean;
  itemSeconds: number | null;
  mustAnswer: boolean;
  /** In a forward-only section's review, once its last question is reached. */
  reviewing: boolean;
};

export function getSectionMoves({
  changed,
  changesLeft,
  navigation,
  reached,
  total,
}: {
  /** The questions the review changed already, which change again without using another. */
  changed: readonly number[];
  changesLeft: number | null;
  navigation: MockSectionView["navigation"];
  /** The furthest question opened in the section. */
  reached: number;
  total: number;
}): SectionMoves {
  const forwardOnly = navigation?.forwardOnly ?? false;
  const reviewing = forwardOnly && navigation?.answerChanges !== null && reached >= total - 1;
  const changes = reviewing ? changesLeft : null;

  return {
    canChange: (position) =>
      !forwardOnly || position >= reached || changed.includes(position) || (changes ?? 0) > 0,
    canOpen: (position) =>
      !forwardOnly || reviewing || position === reached || position === reached + 1,
    changesLeft: changes,
    forwardOnly,
    itemSeconds: reviewing ? null : (navigation?.itemSeconds ?? null),
    mustAnswer: navigation?.mustAnswer ?? false,
    reviewing,
  };
}
