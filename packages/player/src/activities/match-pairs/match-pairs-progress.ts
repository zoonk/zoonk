import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type MatchCard } from "./match-pairs-columns";

export type MatchProgress = {
  firstTries: Readonly<Record<string, string>>;
  matched: readonly string[];
};

const EMPTY_MATCH_PROGRESS: MatchProgress = { firstTries: {}, matched: [] };

export function isMatch(left: MatchCard, right: MatchCard): boolean {
  return left.id === right.id;
}

export function recordTry(
  progress: MatchProgress,
  { left, right }: { left: MatchCard; right: MatchCard },
): MatchProgress {
  const firstTries =
    progress.firstTries[left.id] === undefined
      ? { ...progress.firstTries, [left.id]: right.id }
      : progress.firstTries;

  const matched = isMatch(left, right) ? [...progress.matched, left.id] : progress.matched;

  return { firstTries, matched };
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

  return { firstTries: answer.pairs, matched: Object.keys(answer.pairs) };
}
