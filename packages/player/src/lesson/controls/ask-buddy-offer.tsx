"use client";

import { useTaskAsideShown } from "@zoonk/learn/task-header";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTutorBuddy } from "../../questions/tutor-buddy";
import { getLessonFocusTarget } from "../_utils/lesson-focus";
import { type ExplainingStep } from "../_utils/lesson-struggle";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { DidntGetItButton, hasDidntGetIt } from "./didnt-get-it-button";
import { useStrugglePause } from "./use-struggle-pause";

export function AskBuddyOffer({ reason }: { reason: "misses" | "pause" }) {
  const t = useExtracted();
  const buddy = useTutorBuddy();
  const asideShown = useTaskAsideShown();
  const [dismissed, setDismissed] = useState(false);
  const removedWithFocus = useRef(false);

  const offerRef = useCallback(
    (offer: HTMLDivElement | null) => () => {
      removedWithFocus.current = offer?.contains(document.activeElement) ?? false;
    },
    [],
  );

  useLayoutEffect(() => {
    if (asideShown && removedWithFocus.current) {
      getLessonFocusTarget()?.focus({ preventScroll: true });
    }

    removedWithFocus.current = false;
  });

  if (!buddy || buddy.consulted || asideShown || dismissed) {
    return null;
  }

  const { name } = buddy.identity;

  return (
    <div
      aria-live="polite"
      className="border-border flex flex-col gap-2 border-t pt-3 text-sm"
      data-slot="lesson-ask-buddy-offer"
      ref={offerRef}
    >
      <p>
        {reason === "misses"
          ? t("This one is tricky. {name} can explain it another way.", { name })
          : t("Taking your time? {name} can explain it another way.", { name })}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          aria-haspopup={buddy.popup}
          className="pl-1.5"
          onClick={() => buddy.open("simpler")}
          size="lg"
          variant="outline"
        >
          <span aria-hidden="true" className="flex size-6 items-center justify-center *:size-6!">
            {buddy.identity.avatar}
          </span>
          {t("Ask {name}", { name })}
        </Button>

        <Button onClick={() => setDismissed(true)} size="lg" variant="ghost">
          {t("No thanks")}
        </Button>
      </div>
    </div>
  );
}

function StrugglePauseOffer({ step }: { step: ExplainingStep }) {
  const { screen } = useLessonPlayer();
  const isStuck = useStrugglePause(step);

  return isStuck && !screen.quickCheck ? <AskBuddyOffer reason="pause" /> : null;
}

export function ExplainingScreenHelp({ step }: { step: ExplainingStep }) {
  const { lesson } = useLessonPlayerConfig();

  return hasDidntGetIt({ step, targetLanguage: lesson.targetLanguage }) ? (
    <DidntGetItButton />
  ) : (
    <StrugglePauseOffer step={step} />
  );
}
