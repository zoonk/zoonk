import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type MatchCard } from "./match-pairs-columns";

/**
 * Matched pairs (locked in), each pair's first try and the traps that caught the learner. Wrong
 * tries explain themselves and can be retried, but the answer keeps each pair's first try, so
 * finding it by elimination still teaches without counting as knowing it. A trap that caught the
 * learner stays marked as having no match, so it can't catch them twice.
 */
export type MatchProgress = {
  firstTries: Readonly<Record<string, string>>;
  matched: readonly string[];
  traps: readonly string[];
};

const EMPTY_MATCH_PROGRESS: MatchProgress = { firstTries: {}, matched: [], traps: [] };

export function isMatch(left: MatchCard, right: MatchCard): boolean {
  return !left.isTrap && left.id === right.id;
}

/**
 * Records a try: its first try if the left card is a real pair, the pair if it matches, and the
 * trap if one caught the learner.
 */
export function recordTry(
  progress: MatchProgress,
  { left, right }: { left: MatchCard; right: MatchCard },
): MatchProgress {
  const firstTries =
    left.isTrap || progress.firstTries[left.id] !== undefined
      ? progress.firstTries
      : { ...progress.firstTries, [left.id]: right.id };

  const matched = isMatch(left, right) ? [...progress.matched, left.id] : progress.matched;
  const traps = [left, right].filter((card) => card.isTrap).map((card) => card.id);

  return { firstTries, matched, traps: [...progress.traps, ...traps] };
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

  return { firstTries: answer.pairs, matched: Object.keys(answer.pairs), traps: [] };
}
