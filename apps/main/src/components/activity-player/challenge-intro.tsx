"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { DimensionList, buildDimensionEntries } from "./dimension-inventory";
import { type DimensionInventory } from "./player-reducer";

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

        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {t("Make choices.")}
          <br />
          {t("Balance the outcome.")}
        </h1>

        <p className="text-muted-foreground text-base leading-relaxed">
          {t(
            "You'll face a series of decisions. Each one shifts your scores. Don't let any go negative.",
          )}
        </p>
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
