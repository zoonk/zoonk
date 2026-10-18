"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

/**
 * The one phase a change moves the end of, as Plan dates it: "Basics ends Oct 1 instead of
 * Oct 7." Null when it moves none, or more than one, which `PhaseEndMoves` lists.
 */
export function usePhaseEndsText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function phaseEndsText(effect: PlanChangeView["effect"]): string | null {
    const [move, ...others] = effect?.phaseEnds ?? [];

    if (!move || others.length > 0) {
      return null;
    }

    return t("{phase} ends {after} instead of {before}.", {
      after: formatDate(move.after, "long"),
      before: formatDate(move.before, "long"),
      phase: move.name,
    });
  };
}

/** The phases a change moves the end of, one row each when it moves more than one: "Basics: Nov 7 (was Oct 10)". */
export function usePhaseEndRows() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function phaseEndRows(effect: PlanChangeView["effect"]): string[] {
    const moves = effect?.phaseEnds ?? [];

    return moves.length > 1
      ? moves.map((move) =>
          t("{phase}: {after} (was {before})", {
            after: formatDate(move.after, "long"),
            before: formatDate(move.before, "long"),
            phase: move.name,
          }),
        )
      : [];
  };
}
