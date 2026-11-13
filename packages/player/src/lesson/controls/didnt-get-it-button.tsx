"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useTutorBuddy } from "../../questions/tutor-buddy";
import { isExplaining } from "../_utils/lesson-struggle";
import { type PlayableLibraryStep } from "../lesson-player-types";

/** Knowledge lessons offer "I didn't get this" on every explaining screen; language lessons offer help after a long pause. */
export function hasDidntGetIt({
  step,
  targetLanguage,
}: {
  step: PlayableLibraryStep | null;
  targetLanguage: string | null;
}): boolean {
  return !targetLanguage && isExplaining(step);
}

export function DidntGetItButton() {
  const t = useExtracted();
  const buddy = useTutorBuddy();

  if (!buddy?.canAsk) {
    return null;
  }

  return (
    <Button
      className="text-muted-foreground w-fit"
      edge="start"
      data-slot="didnt-get-it"
      onClick={() => buddy.openAndAsk("simpler")}
      size="sm"
      variant="ghost"
    >
      <span aria-hidden="true" className="flex size-6 items-center justify-center *:size-6!">
        {buddy.identity.avatar}
      </span>
      {t({
        description:
          "Quiet button under a lesson's explanation, in the learner's own words when they didn't understand it, as short as they'd say it (Portuguese: 'Não entendi'). Tapping it asks their study buddy to explain the screen more simply.",
        message: "I didn't get this",
      })}
    </Button>
  );
}
