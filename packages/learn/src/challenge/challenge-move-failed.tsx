"use client";

import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../_components/save-error";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useChallengeScreen } from "./challenge-context";

/** What a refused or failed move says, or null, for the bar's note. */
export function useMoveFailed(): React.ReactNode {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();
  const { move } = useChallengeScreen();

  if (move.refusal?.kind === "moveBeforeNextMonday") {
    return (
      <ChangeSaveError>
        {t(
          "A weekly challenge or mock exam can move only to a day on or after next Monday. It stays where it is.",
        )}
      </ChangeSaveError>
    );
  }

  if (move.refusal?.kind === "mockCollision") {
    return (
      <ChangeSaveError>
        {t("That day already has a weekly challenge or mock exam, so this one stays where it is.")}
      </ChangeSaveError>
    );
  }

  if (move.refusal?.kind === "noRoom") {
    return (
      <ChangeSaveError>
        {t("Your plan can't make room for this challenge on Monday. It stays where it is.")}
      </ChangeSaveError>
    );
  }

  if (move.refusal?.kind === "unfundedMove") {
    const { date, minutes } = move.refusal.unfundedMove;

    return (
      <ChangeSaveError>
        {t(
          "Your plan can't make room for this {duration} mock exam on {date}. It stays where it is.",
          { date: formatDate(date), duration: formatDuration(minutes) },
        )}
      </ChangeSaveError>
    );
  }

  if (!move.failed) {
    return null;
  }

  return <ChangeSaveError />;
}
