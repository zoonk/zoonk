import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type MatchCard } from "./match-pairs-columns";

/**
 * Matched pairs (locked in) and each pair's first try. Wrong tries explain themselves and can be
 * retried, but the answer keeps each pair's first try, so finding it by elimination still
 * teaches without counting as knowing it.
 */
export type MatchProgress = {
  firstTries: Readonly<Record<string, string>>;
  matched: readonly string[];
};

const EMPTY_MATCH_PROGRESS: MatchProgress = { firstTries: {}, matched: [] };

export function isMatch(left: MatchCard, right: MatchCard): boolean {
  return !left.isTrap && left.id === right.id;
}

/** Records a try: its first try if the left card is a real pair, and the pair if it matches. */
export function recordTry(
  progress: MatchProgress,
  { left, right }: { left: MatchCard; right: MatchCard },
): MatchProgress {
  const firstTries =
    left.isTrap || progress.firstTries[left.id] !== undefined
      ? progress.firstTries
      : { ...progress.firstTries, [left.id]: right.id };

  const matched = isMatch(left, right) ? [...progress.matched, left.id] : progress.matched;

  return { firstTries, matched };
}

/** The answer once every pair is matched: each pair's first try. */
export function matchAnswer(
  pairIds: readonly string[],
  progress: MatchProgress,
): Extract<ActivityAnswer, { kind: "assignment" }> | null {
  if (!pairIds.every((id) => progress.matched.includes(id))) {
    return null;
  }

  return {
    kind: "assignment",
    pairs: Object.fromEntries(pairIds.map((id) => [id, progress.firstTries[id] ?? id])),
  };
}

/** Rebuilds progress from a saved answer, for a screen the learner comes back to. */
export function progressFromAnswer(answer: ActivityAnswer | null): MatchProgress {
  if (answer?.kind !== "assignment") {
    return EMPTY_MATCH_PROGRESS;
  }

  return { firstTries: answer.pairs, matched: Object.keys(answer.pairs) };
}
