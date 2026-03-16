"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type DimensionInventory } from "../player-reducer";
import { DimensionList, buildDimensionEntries } from "./dimension-inventory";
import { SectionLabel } from "./section-label";

export function ChallengeIntro({
  dimensions,
  onStart,
}: {
  dimensions: DimensionInventory;
  onStart: () => void;
}) {
  const t = useExtracted();
  const entries = buildDimensionEntries(dimensions, []);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 text-left">
      <div className="flex flex-col gap-4">
        <SectionLabel>{t("Challenge")}</SectionLabel>

        <h1 className="text-foreground text-xl font-semibold tracking-tight">{t("How to play")}</h1>

        <ol className="text-muted-foreground list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-pretty">
          <li>{t("You start at 0 in every score.")}</li>
          <li>{t("Each choice raises some scores and lowers others.")}</li>
          <li>{t("If any score ends below zero, game over.")}</li>
          <li>{t("No choice is right or wrong — every one has trade-offs.")}</li>
          <li>{t("Choose carefully. You can't undo.")}</li>
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>{t("Your scores")}</SectionLabel>

        <DimensionList aria-label={t("Starting scores")} entries={entries} variant="intro" />
      </div>

      <Button className="w-full" onClick={onStart} size="lg">
        {t("Begin")}
      </Button>
    </div>
  );
}
