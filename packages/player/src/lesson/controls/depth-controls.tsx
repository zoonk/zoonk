"use client";

import { Button } from "@zoonk/ui/components/button";
import { FeatherIcon, LayersIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useLessonPlayer } from "../lesson-player-context";
import { useLessonInteraction } from "../lesson-player-interaction";
import { type StepVariantKind } from "../lesson-player-types";
import { DepthSheet } from "./depth-sheet";
import { SimplerOffer } from "./simpler-offer";
import { type DeeperFirst } from "./use-deeper-first";
import { type DepthStep, type VariantTrigger, useStepVariant } from "./use-step-variant";
import { useStrugglePause } from "./use-struggle-pause";

/**
 * "Simpler", "Go deeper" and "I know this" under an explanation: depth on demand without leaving
 * the lesson, and a quick check for what the learner already knows. When the screen already opened
 * its deeper version (`deeperFirst`), "Go deeper" switches between it and the original in place.
 */
export function DepthControls({
  deeperFirst,
  step,
}: {
  deeperFirst?: DeeperFirst;
  step: DepthStep;
}) {
  const t = useExtracted();
  const { actions, screen } = useLessonPlayer();
  const { setPaused } = useLessonInteraction();
  const variant = useStepVariant(step);
  const isStuck = useStrugglePause(step);
  const [openKind, setOpenKind] = useState<StepVariantKind | null>(null);

  function open(kind: StepVariantKind, trigger: VariantTrigger = "button") {
    setOpenKind(kind);
    setPaused(true);
    void variant.request(kind, trigger);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setOpenKind(null);
      setPaused(false);
    }
  }

  const showSimpler = variant.isAvailable("simpler");
  const showDeeper = variant.isAvailable("deeper");

  if (!showSimpler && !showDeeper && !screen.canKnowThis) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {isStuck && showSimpler && !screen.quickCheck && (
        <SimplerOffer onAccept={() => open("simpler", "struggle")} reason="pause" />
      )}

      <div className="flex flex-wrap gap-2" data-slot="lesson-depth-controls">
        {showSimpler && (
          <Button onClick={() => open("simpler")} size="sm" variant="secondary">
            <FeatherIcon aria-hidden="true" />
            {t("Simpler")}
          </Button>
        )}

        {showDeeper && deeperFirst?.canSwitch && (
          <Button onClick={deeperFirst.toggle} size="sm" variant="secondary">
            <LayersIcon aria-hidden="true" />
            {deeperFirst.showsOriginal ? t("Go deeper") : t("Show the original")}
          </Button>
        )}

        {showDeeper && !deeperFirst?.canSwitch && (
          <Button onClick={() => open("deeper")} size="sm" variant="secondary">
            <LayersIcon aria-hidden="true" />
            {t("Go deeper")}
          </Button>
        )}

        {screen.canKnowThis && (
          <Button onClick={actions.knowThis} size="sm" variant="ghost">
            <ZapIcon aria-hidden="true" />
            {t("I know this")}
          </Button>
        )}

        <DepthSheet
          kind={openKind}
          onOpenChange={handleOpenChange}
          onRetry={() => openKind && void variant.request(openKind)}
          state={openKind ? variant.getState(openKind) : { status: "idle" }}
        />
      </div>
    </div>
  );
}
