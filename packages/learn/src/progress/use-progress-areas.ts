"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { useSkillNames } from "../_utils/skill-names";
import { useFormatDuration } from "../_utils/time-format";
import { useProgressScreen } from "./progress-context";

/** A few areas at first, so a big goal's list stays calm; "Show more" opens the rest. */
const FIRST_AREAS = 6;

type ProgressView = ReturnType<typeof useProgressScreen>["progress"];
type StillNeededArea = ProgressView["stillNeeded"]["areas"][number];

/**
 * One area of the goal: how prepared it is (the same measure as the goal's preparation), what's
 * still needed there with the plan's time for it, and the practice shortcut on the weakest.
 */
export type ProgressAreaRow = {
  areaId: string;
  /** "4 skills left · about 20 min", or that nothing is left. */
  detail: string;
  isDone: boolean;
  isWeakest: boolean;
  /** The next skills to reach the bar; null when nothing is left. */
  next: string | null;
  /** Its place in plan order, which keeps each area's color in Fun when the list opens. */
  position: number;
  /** Null for skills outside the plan's areas, which have no preparation of their own. */
  preparation: number | null;
  title: string;
  weekGain: number;
};

function useNextSkills() {
  const t = useExtracted();
  const skillNames = useSkillNames();

  return function describeNext(area: StillNeededArea): string | null {
    if (area.left.length === 0) {
      return null;
    }

    return t("Next: {skills}", { skills: skillNames(area.left.map((skill) => skill.name)) });
  };
}

function useAreaDetail() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (area: StillNeededArea): string =>
    area.left.length === 0
      ? t("Nothing left here")
      : [
          t("{count, plural, one {# skill left} other {# skills left}}", {
            count: area.left.length,
          }),
          area.minutes > 0 && t("about {time}", { time: formatDuration(area.minutes) }),
        ]
          .filter(Boolean)
          .join(" · ");
}

/** The whole goal: skills still below their bar and the plan's time, or that it's all there. */
function useSummary(stillNeeded: ProgressView["stillNeeded"]) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  if (stillNeeded.left === 0) {
    return t("Everything your goal needs is where it should be. Keep reviewing so it stays there.");
  }

  return [
    t("{count, plural, one {# skill to go} other {# skills to go}}", { count: stillNeeded.left }),
    stillNeeded.minutes > 0 &&
      t("about {time} of study in your plan", { time: formatDuration(stillNeeded.minutes) }),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "Your areas" for both modes: one row per area in plan order with its preparation and what's
 * still needed to reach the goal there, so each area is listed once. The first few show, plus the
 * weakest wherever it falls, so "Practice now" is always on screen; the rest open on request.
 */
export function useProgressAreas() {
  const t = useExtracted();
  const nextSkills = useNextSkills();
  const areaDetail = useAreaDetail();
  const { progress } = useProgressScreen();
  const [showAll, setShowAll] = useState(false);
  const { preparation, stillNeeded } = progress;
  const summary = useSummary(stillNeeded);
  const measured = new Map((preparation?.areas ?? []).map((area) => [area.areaId, area]));

  const rows: ProgressAreaRow[] = stillNeeded.areas.map((area, position) => ({
    areaId: area.areaId,
    detail: areaDetail(area),
    isDone: area.left.length === 0,
    isWeakest: area.areaId === preparation?.weakestAreaId,
    next: nextSkills(area),
    position,
    preparation: measured.get(area.areaId)?.preparation ?? null,
    title: area.title || t("Other skills"),
    weekGain: measured.get(area.areaId)?.weekGain ?? 0,
  }));

  const shown = showAll ? rows : rows.filter((row, index) => index < FIRST_AREAS || row.isWeakest);

  const rule =
    stillNeeded.rule === "examWeighted"
      ? t("The topics that weigh most need to be Solid; the rest, started.")
      : t("Every skill needs to be Solid: remembered a week from now.");

  return {
    hiddenCount: rows.length - shown.length,
    rows: shown,
    rule,
    showAll: () => setShowAll(true),
    summary,
    visible: rows.length > 0,
  };
}
