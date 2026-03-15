"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type DimensionInventory } from "../player-reducer";
import { DimensionList, buildDimensionEntries } from "./dimension-inventory";

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
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t("Challenge")}
        </span>

        <h1 className="text-foreground text-xl font-semibold tracking-tight">{t("How to play")}</h1>

        <ol className="text-muted-foreground list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-pretty">
          <li>{t("You start with 0 points in each score below.")}</li>
          <li>{t("Every choice raises some scores and lowers others.")}</li>
          <li>{t("If any score drops below zero, it's game over.")}</li>
          <li>{t('No option is "right" or "wrong" — every choice has trade-offs.')}</li>
          <li>{t("Think carefully. You cannot undo a choice.")}</li>
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t("Your scores")}
        </span>

        <DimensionList aria-label={t("Starting scores")} entries={entries} variant="intro" />
      </div>

      <Button className="w-full" onClick={onStart} size="lg">
        {t("Begin")}
      </Button>
    </div>
  );
}
