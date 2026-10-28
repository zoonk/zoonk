import { type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";

export type SectionMoves = {
  canAdvance: boolean;
  canOpenAfterTimeout: (position: number) => boolean;
  canChange: (position: number) => boolean;
  canOpen: (position: number) => boolean;
  /** Null outside a review or without a limit. */
  changesLeft: number | null;
  forwardOnly: boolean;
  itemSeconds: number | null;
  mustAnswer: boolean;
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
  changed: readonly number[];
  changesLeft: number | null;
  navigation: MockSectionView["navigation"];
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
