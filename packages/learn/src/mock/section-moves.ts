import { type MockAnswer } from "@zoonk/core/exams/mocks/answer-contract";
import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { type MockDraft, type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";

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

/** The server charges a review change once per question, so these change again for free. */
export function getChargedPositions(view: MockView): number[] {
  const questions = view.current?.questions ?? [];

  return (view.current?.changedItemIds ?? []).map((itemId) =>
    questions.findIndex((question) => question.itemId === itemId),
  );
}

/** `changed` starts from the server's charged questions, which its `changesLeft` already counts. */
export function getCurrentSectionMoves({
  answered,
  changed,
  position,
  reached,
  view,
}: {
  answered: boolean;
  changed: readonly number[];
  position: number;
  reached: number;
  view: MockView;
}): SectionMoves {
  const changesLeft = view.current?.changesLeft ?? null;
  const charged = getChargedPositions(view);
  const notCharged = changed.filter((target) => !charged.includes(target)).length;

  return getSectionMoves({
    answered,
    changed,
    changesLeft: changesLeft === null ? null : Math.max(0, changesLeft - notCharged),
    navigation: view.sections.find((section) => section.status === "current")?.navigation ?? null,
    position,
    reached,
    total: view.current?.questions.length ?? 0,
  });
}

/** The questions a review has changed once `position` takes `answer`, or null when it can't. */
export function getChangedAfterAnswer({
  answer,
  changed,
  moves,
  position,
  reached,
  saved,
}: {
  answer: MockAnswer | null;
  changed: readonly number[];
  moves: SectionMoves;
  position: number;
  reached: number;
  saved: MockAnswer | null;
}): readonly number[] | null {
  if (!moves.canChange(position)) {
    return null;
  }

  const isChange =
    moves.reviewing && position < reached && JSON.stringify(saved) !== JSON.stringify(answer);

  return isChange && !changed.includes(position) ? [...changed, position] : changed;
}

/** Where the section stands once the answers this device kept reach the server, in order. */
export function replayKeptAnswers({ kept, view }: { kept: readonly MockDraft[]; view: MockView }): {
  changed: readonly number[];
  reached: number;
} {
  const questions = view.current?.questions ?? [];
  const stored = view.current?.drafts ?? [];
  let changed: readonly number[] = getChargedPositions(view);
  let reached = view.current?.resume ?? 0;

  for (const draft of kept) {
    const position = questions.findIndex((question) => question.itemId === draft.itemId);
    reached = Math.max(reached, position);

    changed =
      getChangedAfterAnswer({
        answer: draft.answer,
        changed,
        moves: getCurrentSectionMoves({ answered: false, changed, position, reached, view }),
        position,
        reached,
        saved: stored.find((other) => other.itemId === draft.itemId)?.answer ?? null,
      }) ?? changed;
  }

  return { changed, reached };
}
