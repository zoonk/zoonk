import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/playable-lesson";
import { type MatchEntryState } from "./match-entry";

export type MatchSide = "left" | "right";

/** One pair the learner tried, by each card's place in its column as shown. */
export type MatchTry = { left: number; right: number };

export const UNPAIRED = -1;

type Selection = { index: number; side: MatchSide };

export type MatchBoardState = {
  /** The wrong try showing right now. */
  cue: MatchTry | null;
  /** The last try, while it was a wrong one. */
  missed: MatchTry | null;
  misses: MatchTry[];
  /** For each left card, the place of the right card it's paired with. */
  pairs: number[];
  selected: Selection | null;
};

export type MatchMove =
  | { kind: "none" }
  | { kind: "select" }
  | { attempt: MatchTry; kind: "miss" | "unpair" }
  | { attempt: MatchTry; done: boolean; kind: "pair" };

type Tap = {
  index: number;
  /** Checks each try as it's made; without it the board only holds pairs. */
  isPair?: (attempt: MatchTry) => boolean;
  side: MatchSide;
  total: number;
};

/** `pairs` is a board the learner already finished. */
export function createMatchBoard({
  leftCount,
  pairs,
}: {
  leftCount: number;
  pairs?: number[];
}): MatchBoardState {
  return {
    cue: null,
    missed: null,
    misses: [],
    pairs: pairs ?? Array.from({ length: leftCount }, () => UNPAIRED),
    selected: null,
  };
}

export function partnerIn(pairs: readonly number[], side: MatchSide, index: number): number {
  return side === "left" ? (pairs[index] ?? UNPAIRED) : pairs.indexOf(index);
}

export function pairedCount(pairs: readonly number[]): number {
  return pairs.filter((right) => right !== UNPAIRED).length;
}

function unpair(board: MatchBoardState, { index, side }: Tap): ReturnType<typeof tapCard> {
  const left = side === "left" ? index : partnerIn(board.pairs, side, index);
  const attempt = { left, right: board.pairs[left] ?? UNPAIRED };
  const pairs = board.pairs.map((match, position) => (position === left ? UNPAIRED : match));

  return { board: { ...board, cue: null, missed: null, pairs }, move: { attempt, kind: "unpair" } };
}

function select(board: MatchBoardState, { index, side }: Tap): ReturnType<typeof tapCard> {
  const same = board.selected?.side === side && board.selected.index === index;

  return {
    board: { ...board, cue: null, selected: same ? null : { index, side } },
    move: { kind: "select" },
  };
}

/**
 * What a tap on a card does: a card on either side, then one on the other, tries a pair; another
 * card on the same side changes the pick, and the picked card again clears it. A checked board
 * locks a right pair and keeps the first card picked after a wrong one; an unchecked board pairs
 * any two and undoes a pair from either of its cards.
 */
export function tapCard(
  board: MatchBoardState,
  tap: Tap,
): { board: MatchBoardState; move: MatchMove } {
  const { index, isPair, side, total } = tap;
  const { selected } = board;

  if (partnerIn(board.pairs, side, index) !== UNPAIRED) {
    return isPair ? { board, move: { kind: "none" } } : unpair(board, tap);
  }

  if (!selected || selected.side === side) {
    return select(board, tap);
  }

  const attempt =
    side === "left"
      ? { left: index, right: selected.index }
      : { left: selected.index, right: index };

  if (isPair && !isPair(attempt)) {
    return {
      board: { ...board, cue: attempt, missed: attempt, misses: [...board.misses, attempt] },
      move: { attempt, kind: "miss" },
    };
  }

  const pairs = board.pairs.map((match, position) =>
    position === attempt.left ? attempt.right : match,
  );

  return {
    board: { ...board, cue: null, missed: null, pairs, selected: null },
    move: { attempt, done: pairedCount(pairs) === total, kind: "pair" },
  };
}

/** How a card looks: picked, paired, locked right, or a wrong try. */
export function cardState(
  board: MatchBoardState,
  { checks, index, side }: { checks: boolean; index: number; side: MatchSide },
): MatchEntryState {
  const { cue, pairs, selected } = board;

  if (partnerIn(pairs, side, index) !== UNPAIRED) {
    return checks ? "right" : "matched";
  }

  if (cue && (side === "left" ? cue.left : cue.right) === index) {
    return "wrong";
  }

  return selected?.side === side && selected.index === index ? "selected" : "idle";
}

/** Each left card's first wrong try, in the order they happened. */
export function firstMisses(misses: readonly MatchTry[]): MatchTry[] {
  return misses.filter(
    (miss, index) => misses.findIndex((other) => other.left === miss.left) === index,
  );
}

/** A lesson screen whose board checks each pair as it's made and sends itself with the last one. */
export function checksEachPair(step: PlayableLibraryStep): boolean {
  return (
    step.kind === "matchColumns" ||
    (step.kind === "activity" && step.content.template === "matchPairs")
  );
}
