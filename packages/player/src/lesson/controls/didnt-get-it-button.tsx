"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { COLUMN_GHOST_ACTION_CLASS } from "../../components/step-layouts";
import { useTutorBuddy } from "../../questions/tutor-buddy";

export function DidntGetItButton() {
  const t = useExtracted();
  const buddy = useTutorBuddy();

  if (!buddy?.canAsk) {
    return null;
  }

  return (
    <Button
      className={cn(COLUMN_GHOST_ACTION_CLASS, "text-muted-foreground pl-1.5")}
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
