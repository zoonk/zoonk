"use client";

import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useChallengeScreen } from "./challenge-context";

/**
 * A move or its undo that didn't go through. A mock the days before Monday can't save its time for
 * says so, with the day and its real length; one onto a day that already has a mock says that.
 * Either way it stays where it is, and the line says so instead of asking for another day: Monday
 * is this screen's only move, and Undo's only day is the one it came from.
 */
export function MoveFailed() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();
  const { move } = useChallengeScreen();

  if (move.refusal?.kind === "mockCollision") {
    return (
      <p className="text-destructive-text text-sm text-pretty" role="alert">
        {t("That day already has a mock exam, so this one stays where it is.")}
      </p>
    );
  }

  if (move.refusal?.kind === "unfundedMove") {
    const { date, minutes } = move.refusal.unfundedMove;

    return (
      <p className="text-destructive-text text-sm text-pretty" role="alert">
        {t(
          "Your plan can't make room for this {duration} mock exam on {date}. It stays where it is.",
          { date: formatDate(date), duration: formatDuration(minutes) },
        )}
      </p>
    );
  }

  if (!move.failed) {
    return null;
  }

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("That didn't go through. Try again in a moment.")}
    </p>
  );
}
