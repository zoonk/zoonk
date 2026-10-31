import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type MatchCard } from "./match-pairs-columns";

export type MatchProgress = {
  firstTries: Readonly<Record<string, string>>;
  matched: readonly string[];
  traps: readonly string[];
};

const EMPTY_MATCH_PROGRESS: MatchProgress = { firstTries: {}, matched: [], traps: [] };

export function isMatch(left: MatchCard, right: MatchCard): boolean {
  return !left.isTrap && left.id === right.id;
}

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

export function progressFromAnswer(answer: ActivityAnswer | null): MatchProgress {
  if (answer?.kind !== "assignment") {
    return EMPTY_MATCH_PROGRESS;
  }

  return { firstTries: answer.pairs, matched: Object.keys(answer.pairs), traps: [] };
}
