"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

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
