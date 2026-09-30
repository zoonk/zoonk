"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CheckIcon, NotebookPenIcon, SunriseIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StatTile, StatTileLabel, StatTileValue } from "../../_components/stat-tile";
import { useFormatShare } from "../../_utils/percent";
import { useBeltName } from "../../_utils/use-belt-name";
import { SummaryActions, SummaryMilestone } from "./summary-actions";
import { useSessionSummary } from "./summary-context";
import { ComesBackLine, PreparationChange, SkillMoves, useSummaryLine } from "./summary-parts";

/** Energy is kept 0–100; percentages format as shares so every language spaces "%" its way. */
const PERCENT = 100;

function SummaryTiles() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const beltName = useBeltName();
  const { summary } = useSessionSummary();
  const energyGain = summary.energy ? Math.round(summary.energy.after - summary.energy.before) : 0;

  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile>
        <StatTileValue>{t("+{points}", { points: String(summary.brainPower) })}</StatTileValue>
        <StatTileLabel>{t("Brain Power")}</StatTileLabel>
      </StatTile>

      {summary.energy && (
        <StatTile>
          <StatTileValue>
            <ZapIcon aria-hidden="true" className="text-energy size-4" />
            {formatShare(Math.round(summary.energy.after) / PERCENT)}
          </StatTileValue>
          <StatTileLabel>
            {energyGain > 0 ? t("Energy +{gain}", { gain: String(energyGain) }) : t("Energy")}
          </StatTileLabel>
        </StatTile>
      )}

      {summary.belt && (
        <StatTile>
          <StatTileValue>
            <BeltIndicator
              color={summary.belt.after.color}
              label={beltName(summary.belt.after.color)}
              size="sm"
            />
            {summary.belt.after.level}
          </StatTileValue>
          <StatTileLabel>{beltName(summary.belt.after.color)}</StatTileLabel>
        </StatTile>
      )}
    </div>
  );
}

function WhatChanged() {
  const t = useExtracted();
  const { summary } = useSessionSummary();

  const hasChanges =
    summary.preparation.after !== null ||
    summary.skillsMoved.length > 0 ||
    summary.mistakesSaved > 0 ||
    summary.comesBack.length > 0;

  // A short day can change none of these; an empty card would read as something missing.
  if (!hasChanges) {
    return null;
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-3xl border p-4 shadow-sm">
      <PreparationChange />
      <SkillMoves />

      {summary.mistakesSaved > 0 && (
        <p className="flex items-start gap-2 text-sm">
          <LineMarker>
            <NotebookPenIcon aria-hidden="true" className="text-muted-foreground size-4" />
          </LineMarker>
          {t(
            "{count, plural, one {# mistake saved for review} other {# mistakes saved for review}}",
            { count: summary.mistakesSaved },
          )}
        </p>
      )}

      <ComesBackLine />
    </section>
  );
}

/**
 * Focus's end of session: not "lesson complete" but what changed today (preparation, the skills
 * that moved, mistakes saved, when ideas come back), Brain Power, Energy and the belt, and at
 * most one milestone.
 */
export function FocusSummary() {
  const t = useExtracted();
  const line = useSummaryLine();
  const { summary } = useSessionSummary();

  return (
    <div className="flex flex-1 flex-col gap-6" data-slot="focus-summary">
      <span className="bg-success/10 text-success flex size-14 items-center justify-center rounded-full">
        <CheckIcon aria-hidden="true" className="size-7" />
      </span>

      <header className="flex flex-col gap-1" role="status">
        <h1 className="text-3xl font-semibold tracking-tight">{t("Today's session is done")}</h1>
        <p className="text-muted-foreground">{line}</p>
      </header>

      <WhatChanged />
      <SummaryTiles />
      <SummaryMilestone />

      {summary.tomorrow && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <LineMarker>
            <SunriseIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("Tomorrow: {title}", { title: summary.tomorrow.title })}
        </p>
      )}

      <SummaryActions />
    </div>
  );
}
