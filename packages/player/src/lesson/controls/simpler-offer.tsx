"use client";

import { Button } from "@zoonk/ui/components/button";
import { FeatherIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useLessonInteraction } from "../lesson-player-interaction";
import { DepthSheet } from "./depth-sheet";
import { type DepthStep, useStepVariant } from "./use-step-variant";

/**
 * A calm offer of a simpler version when the learner seems stuck: after two misses in a row on the
 * same idea, or a long pause on an explanation. It asks once and "No thanks" puts it away.
 */
export function SimplerOffer({
  onAccept,
  reason,
}: {
  onAccept: () => void;
  reason: "misses" | "pause";
}) {
  const t = useExtracted();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="bg-muted/60 flex flex-col gap-2 rounded-xl px-3 py-2.5 text-sm"
      data-slot="lesson-simpler-offer"
    >
      <p>
        {reason === "misses"
          ? t("This one is tricky. A simpler explanation might help.")
          : t("Taking your time? A simpler version might help.")}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onAccept} size="sm" variant="secondary">
          <FeatherIcon aria-hidden="true" />
          {t("Show a simpler version")}
        </Button>

        <Button onClick={() => setDismissed(true)} size="sm" variant="ghost">
          {t("No thanks")}
        </Button>
      </div>
    </div>
  );
}

/**
 * After two misses in a row on the same idea, the result offers that idea's explanation in a
 * simpler version, over the lesson, without leaving the question.
 */
export function MissedIdeaHelp({ step }: { step: DepthStep }) {
  const { setPaused } = useLessonInteraction();
  const variant = useStepVariant(step);
  const [isOpen, setIsOpen] = useState(false);

  if (!variant.isAvailable("simpler")) {
    return null;
  }

  function accept() {
    setIsOpen(true);
    setPaused(true);
    void variant.request("simpler", "struggle");
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setIsOpen(false);
      setPaused(false);
    }
  }

  return (
    <>
      <SimplerOffer onAccept={accept} reason="misses" />
      <DepthSheet
        kind={isOpen ? "simpler" : null}
        onOpenChange={handleOpenChange}
        onRetry={() => void variant.request("simpler", "struggle")}
        state={isOpen ? variant.getState("simpler") : { status: "idle" }}
      />
    </>
  );
}
