"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { useFormatShare } from "../_utils/percent";
import { FunMoon } from "../plan/fun-moon";
import { FunPace } from "../plan/fun-pace";
import { ExamLink } from "./exam-link";
import { FadingSkills } from "./fading-skills";
import { FunPreparationRing } from "./fun-preparation-ring";
import { MistakesLink } from "./mistakes-link";
import { PracticeNowButton } from "./practice-now-button";
import { AreaDetail, ShowMoreAreas } from "./progress-areas";
import { usePreparation } from "./progress-context";
import { StatsLinks } from "./stats-links";
import { usePreparationParts } from "./use-preparation-parts";
import { type ProgressAreaRow, useProgressAreas } from "./use-progress-areas";
import { useWeekGainText } from "./use-share-delta";
import { WeeklySummary } from "./weekly-summary";

function PartTiles() {
  const t = useExtracted();
  const parts = usePreparationParts();
  const formatShare = useFormatShare();

  return (
    <ul className="grid grid-cols-2 gap-2">
      {parts.map((part) => (
        <li
          className="fun-glass flex flex-col gap-0.5 rounded-2xl p-3"
          data-part={part.key}
          key={part.key}
        >
          <span className="font-fun-display text-xl font-bold tabular-nums">
            {part.value === null ? t("Not yet") : formatShare(part.value)}
          </span>
          <span className="text-fun-fg2 text-xs">{part.label}</span>
        </li>
      ))}
    </ul>
  );
}

function AreaPlanet({ row }: { row: ProgressAreaRow }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const weekGainText = useWeekGainText();
  const gain = weekGainText(row.weekGain);

  return (
    <li
      className={cn(
        "fun-glass flex flex-col gap-3 rounded-3xl p-4",
        row.isWeakest && "fun-holo-border",
      )}
      data-done={row.isDone || undefined}
      data-weakest={row.isWeakest || undefined}
    >
      <div className="flex items-start gap-3">
        <FunMoon index={row.position} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{row.title}</span>
            {row.preparation !== null && (
              <span className="font-fun-display shrink-0 font-bold tabular-nums">
                {formatShare(row.preparation)}
              </span>
            )}
          </div>
          {row.preparation !== null && (
            <Meter>
              <MeterFill className="bg-fun-accent-cyan" share={row.preparation} />
            </Meter>
          )}
          <div className="flex items-start justify-between gap-3">
            <AreaDetail row={row} />
            {gain && (
              <span
                className={cn(
                  "shrink-0 text-xs font-semibold",
                  row.weekGain > 0 ? "text-fun-accent-lime" : "text-fun-fg2",
                )}
              >
                {gain}
              </span>
            )}
          </div>
          {row.next && <p className="text-fun-fg2 text-xs">{row.next}</p>}
        </div>
      </div>
      {row.isWeakest && (
        <div className="bg-fun-soft flex items-center justify-between gap-3 rounded-2xl p-2 pl-3">
          <span className="text-fun-fg2 text-sm">{t("Where you can gain the most")}</span>
          <PracticeNowButton
            areaId={row.areaId}
            className="bg-fun-lime text-fun-lime-foreground hover:bg-fun-lime/90"
          />
        </div>
      )}
    </li>
  );
}

/**
 * Each area as a planet: how prepared it is, what's still needed there and the week's gain, with
 * a shortcut on the weakest, under the whole goal's summary.
 */
function AreaPlanets() {
  const t = useExtracted();
  const areas = useProgressAreas();

  if (!areas.visible) {
    return null;
  }

  return (
    <section aria-labelledby="fun-areas-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-fun-display text-xl font-bold" id="fun-areas-title">
          {t("Your areas")}
        </h2>
        <p className="text-sm">{areas.summary}</p>
        <p className="text-fun-fg2 text-xs">{areas.rule}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {areas.rows.map((row) => (
          <AreaPlanet key={row.areaId} row={row} />
        ))}
      </ul>
      <ShowMoreAreas
        className="fun-glass border-transparent"
        count={areas.hiddenCount}
        onClick={areas.showAll}
      />
    </section>
  );
}

/**
 * Fun's Progress: the same preparation as a ring around the destination planet, the pace against
 * the plan, the four parts as tiles and each area as a planet with what's still needed there. The
 * exam and the mistakes notebook, fading skills, the week and the stats pages follow, as in Focus.
 */
export function FunProgress() {
  const preparation = usePreparation();

  return (
    <div className="flex flex-col gap-8">
      <FunPreparationRing />
      <FunPace status={preparation.status} />
      <PartTiles />
      <AreaPlanets />
      <div className="flex flex-col gap-2">
        <ExamLink />
        <MistakesLink />
      </div>
      <FadingSkills />
      <WeeklySummary />
      <StatsLinks />
    </div>
  );
}
