"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useTutorBuddy } from "../../questions/tutor-buddy";

export function AskBuddyOffer() {
  const t = useExtracted();
  const buddy = useTutorBuddy();
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
      <p>{t("This one is tricky. {name} can explain it another way.", { name })}</p>

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
