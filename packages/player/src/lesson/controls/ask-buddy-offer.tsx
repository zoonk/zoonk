"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { type ExplainingStep } from "../_utils/lesson-struggle";
import { useLessonPlayer } from "../lesson-player-context";
import { useLessonBuddy } from "../tutor/lesson-tutor";
import { useStrugglePause } from "./use-struggle-pause";

/**
 * A calm offer to ask the learner's buddy when they seem stuck, as a quiet line over a hairline: after two misses in a row on the
 * same idea, or a long pause on an explanation. "Ask" opens the questions sheet with "Explain it
 * more simply" ready to send; it asks once and "No thanks" puts it away. Without a tutor (guests)
 * there's nothing to offer, and a learner who already turned to the buddy about the screen knows
 * where it is.
 */
export function AskBuddyOffer({ reason }: { reason: "misses" | "pause" }) {
  const t = useExtracted();
  const buddy = useLessonBuddy();
  const [dismissed, setDismissed] = useState(false);

  if (!buddy || buddy.consulted || dismissed) {
    return null;
  }

  const { name } = buddy.identity;

  return (
    <div
      aria-live="polite"
      className="border-border flex flex-col gap-2 border-t pt-3 text-sm"
      data-slot="lesson-ask-buddy-offer"
    >
      <p>
        {reason === "misses"
          ? t("This one is tricky. {name} can explain it another way.", { name })
          : t("Taking your time? {name} can explain it another way.", { name })}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          className="pl-1.5"
          onClick={() => buddy.open("simpler")}
          size="sm"
          variant="outline"
        >
          <span aria-hidden="true" className="flex size-6 items-center justify-center *:size-6!">
            {buddy.identity.avatar}
          </span>
          {t("Ask {name}", { name })}
        </Button>

        <Button onClick={() => setDismissed(true)} size="sm" variant="ghost">
          {t("No thanks")}
        </Button>
      </div>
    </div>
  );
}

/** The offer on an explanation the learner has stayed on far past its reading time. */
export function StrugglePauseOffer({ step }: { step: ExplainingStep }) {
  const { screen } = useLessonPlayer();
  const isStuck = useStrugglePause(step);

  return isStuck && !screen.quickCheck ? <AskBuddyOffer reason="pause" /> : null;
}
