import { type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";

/**
 * How the running section lets the learner move, as the notice says (`SectionNavigation`): a
 * forward-only section opens one question after another and never an earlier one, until the
 * review at its end (when the notice gives one), which changes only so many answers; `mustAnswer`
 * asks for an answer before moving on, and `itemSeconds` gives each question its own clock.
 */
export type SectionMoves = {
  /** Whether the current answer permits advancing or handing in. */
  canAdvance: boolean;
  /** A question clock may open only the immediate next question without an answer. */
  canOpenAfterTimeout: (position: number) => boolean;
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
  answered,
  changed,
  changesLeft,
  navigation,
  position,
  reached,
  total,
}: {
  answered: boolean;
  position: number;
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

  const canAdvance = !navigation?.mustAnswer || answered || (reviewing && position < reached);

  const canReach = (target: number) =>
    target >= 0 &&
    target < total &&
    (!forwardOnly || reviewing || target === reached || target === reached + 1);

  return {
    canAdvance,
    canChange: (target) =>
      !forwardOnly || target >= reached || changed.includes(target) || (changes ?? 0) > 0,
    canOpen: (target) => canReach(target) && (target === position || canAdvance),
    canOpenAfterTimeout: (target) => target === position + 1 && canReach(target),
    changesLeft: changes,
    forwardOnly,
    itemSeconds: reviewing ? null : (navigation?.itemSeconds ?? null),
    mustAnswer: navigation?.mustAnswer ?? false,
    reviewing,
  };
}
