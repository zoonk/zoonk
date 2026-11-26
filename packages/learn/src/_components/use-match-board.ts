"use client";

import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import { useSentenceSpace } from "../_utils/locale";
import {
  type FinishedBoard,
  type MatchBoardState,
  type MatchMove,
  type MatchSide,
  type MatchTry,
  UNPAIRED,
  cardState,
  createMatchBoard,
  pairedCount,
  partnerIn,
  tapCard,
} from "./match-board-state";

export { type MatchSide, type MatchTry } from "./match-board-state";

export type MatchBoardAnswer = { matches: number[]; misses: MatchTry[] };

/** How long a try shows its verdict: the shake or the lock, then a beat to see which two it was. */
const CUE_MS = 600;

/** Ends a try's moment, unless a newer try took its place. */
function useCueEnd(
  cue: MatchTry | null,
  kind: "cue" | "locked",
  setBoard: Dispatch<SetStateAction<MatchBoardState>>,
) {
  useEffect(() => {
    if (!cue) {
      return;
    }

    const timeout = setTimeout(() => {
      setBoard((current) => (current[kind] === cue ? { ...current, [kind]: null } : current));
    }, CUE_MS);

    return () => clearTimeout(timeout);
  }, [cue, kind, setBoard]);
}

function otherSide(side: MatchSide): MatchSide {
  return side === "left" ? "right" : "left";
}

/** What a screen reader hears after a move: one polite line per try. */
function useMoveLine({
  explainMiss,
  say,
  total,
}: {
  explainMiss?: (attempt: MatchTry) => string | null;
  say: (side: MatchSide, index: number) => string;
  total: number;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();

  return function moveLine(move: MatchMove, pairs: readonly number[]): string | null {
    if (move.kind === "none" || move.kind === "select") {
      return null;
    }

    const left = say("left", move.attempt.left);
    const right = say("right", move.attempt.right);

    if (move.kind === "unpair") {
      return t("Unmatched {left} and {right}.", { left, right });
    }

    if (move.kind === "miss") {
      const why = explainMiss?.(move.attempt);
      const line = t("{left} and {right} don't go together.", { left, right });
      return [line, why].filter(Boolean).join(space);
    }

    return t(
      "Matched {left} with {right}. {matched, plural, one {# of {total} pairs matched.} other {# of {total} pairs matched.}}",
      { left, matched: pairedCount(pairs), right, total: String(total) },
    );
  };
}

/**
 * Picking, pairing and announcing on a "match these with those" board, the same on every screen
 * that draws one (`tapCard` says what a tap does).
 *
 * With `isPair` each try is checked as it's made: a right pair locks (right for a moment, then
 * quiet), a wrong one shows for a moment, and the last pair lays the board out as rows and calls
 * `onComplete` with the pairs and every wrong try, in order. Without it (a test) the learner's
 * pairs wait for a grade, and `onChange` gets them once every card is paired, null before.
 *
 * `say` is a card's text as a screen reader reads it; `explainMiss` adds why a wrong try was wrong.
 * `reveal` shows the answer as rows ("I don't know yet"), the pairs the learner didn't make
 * unmarked.
 */
export function useMatchBoard({
  disabled = false,
  explainMiss,
  finished,
  isPair,
  keys = true,
  leftCount,
  onChange,
  onComplete,
  reveal,
  rightCount,
  say,
}: {
  disabled?: boolean;
  explainMiss?: (attempt: MatchTry) => string | null;
  finished?: FinishedBoard;
  isPair?: (attempt: MatchTry) => boolean;
  /** Whether number keys pick cards; off while something over the screen has them. */
  keys?: boolean;
  leftCount: number;
  onChange?: (matches: number[] | null) => void;
  onComplete?: (answer: MatchBoardAnswer) => void;
  reveal?: readonly number[] | null;
  rightCount: number;
  say: (side: MatchSide, index: number) => string;
}) {
  const t = useExtracted();
  const { trigger } = useWebHaptics();
  const total = Math.min(leftCount, rightCount);
  const moveLine = useMoveLine({ explainMiss, say, total });
  const [board, setBoard] = useState(() => createMatchBoard({ finished, leftCount }));
  const [said, setSaid] = useState("");
  const { pairs } = board;
  const checks = isPair !== undefined;
  const complete = pairedCount(pairs) === total;
  const solved = reveal ?? (checks && complete ? pairs : null);

  useCueEnd(board.cue, "cue", setBoard);
  useCueEnd(board.locked, "locked", setBoard);

  function pick(side: MatchSide, index: number) {
    if (disabled) {
      return;
    }

    const next = tapCard(board, { index, isPair, side, total });
    const line = moveLine(next.move, next.board.pairs);
    setBoard(next.board);

    if (line) {
      setSaid(line);
    }

    if (next.move.kind === "miss") {
      void trigger("warning");
    }

    if (next.move.kind === "unpair") {
      onChange?.(null);
    }

    if (next.move.kind !== "pair") {
      return;
    }

    if (checks) {
      void trigger("light");
    }

    onChange?.(next.move.done ? next.board.pairs : null);

    if (next.move.done && checks) {
      onComplete?.({ matches: next.board.pairs, misses: next.board.misses });
    }
  }

  function label(side: MatchSide, index: number): string {
    const partner = partnerIn(reveal ?? pairs, side, index);
    const entry = say(side, index);

    return partner === UNPAIRED
      ? entry
      : t("{entry}, matched with {other}", { entry, other: say(otherSide(side), partner) });
  }

  useNumberKeys({
    count: leftCount + rightCount,
    enabled: keys && !disabled && !(checks && complete),
    onPick: (key) => {
      const side: MatchSide = key < leftCount ? "left" : "right";
      const index = side === "left" ? key : key - leftCount;

      if (partnerIn(pairs, side, index) !== UNPAIRED) {
        return false;
      }

      pick(side, index);
    },
  });

  return {
    announcement: said,
    complete,
    /** The props a `MatchEntry` takes for one card. */
    entry: (side: MatchSide, index: number) => {
      const partner = partnerIn(pairs, side, index);
      const left = side === "left" ? index : partner;
      const picked = board.selected?.side === side && board.selected.index === index;

      return {
        // A wrong try's moment shows over the pick, which still holds.
        ...(partner === UNPAIRED && { "aria-pressed": picked }),
        disabled,
        index: side === "left" ? index : leftCount + index,
        label: label(side, index),
        onClick: () => pick(side, index),
        pair: partner === UNPAIRED ? undefined : left,
        state: cardState(board, { checks, index, rows: solved !== null, side }),
      };
    },
    /** The last try, while it was a wrong one. */
    missed: board.missed,
    paired: pairedCount(pairs),
    /** For each left card, its partner's place when the board shows rows: solved or revealed. */
    solved,
  };
}
