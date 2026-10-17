import "server-only";
import { type GoalTutorLookUpResult } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type Goal } from "@zoonk/db";
import { getLanguageProgressView } from "../../../view-models/language/get-language-progress-view";
import { type LanguageProgressView } from "../../../view-models/language/language-view-contract";
import {
  type ProgressView,
  getProgressView,
} from "../../../view-models/progress/get-progress-view";
import { type Lookup, toPageLink, toPoints } from "./learner-page-link";
import { matchesArea } from "./lookup-text";

/** Every area of most goals; one asked by `area` comes alone. */
const MAX_AREAS = 12;

/** The first skills an area still needs, by name; `skillsLeft` counts them all. */
const MAX_AREA_SKILLS = 5;

function toPreparation(preparation: ProgressView["preparation"] | undefined) {
  if (!preparation) {
    return null;
  }

  const { estimatedScore } = preparation;

  return {
    estimatedScore: estimatedScore && {
      high: estimatedScore.high,
      low: estimatedScore.low,
      scale: estimatedScore.scale,
    },
    percent: toPoints(preparation.value),
    planStatus: preparation.status?.kind ?? null,
    stage: preparation.stage,
    weakestArea:
      preparation.areas.find((area) => area.areaId === preparation.weakestAreaId)?.title ?? null,
    weekGain: toPoints(preparation.weekGain),
  };
}

type StillNeededArea = ProgressView["stillNeeded"]["areas"][number];

/** The areas still needed, or the one `area` names; null when it names none of them. */
function pickAreas({
  area,
  areas,
}: {
  area: string | null;
  areas: StillNeededArea[];
}): StillNeededArea[] | null {
  const picked = area
    ? areas.filter((candidate) => matchesArea({ area, names: [candidate.title] }))
    : areas;

  return picked.length > 0 || areas.length === 0 ? picked : null;
}

/** What the areas still need, the totals counting only them: the goal's, or the one asked. */
function toStillNeeded(areas: StillNeededArea[]) {
  if (areas.length === 0) {
    return null;
  }

  return {
    areas: areas
      .slice(0, MAX_AREAS)
      .map((area) => ({
        minutes: area.minutes,
        skills: area.left.slice(0, MAX_AREA_SKILLS).map((skill) => skill.name),
        skillsLeft: area.left.length,
        skillsTotal: area.total,
        title: area.title,
      })),
    minutes: areas.reduce((total, area) => total + area.minutes, 0),
    moreAreas: Math.max(0, areas.length - MAX_AREAS),
    skillsLeft: areas.reduce((total, area) => total + area.left.length, 0),
  };
}

/** A language goal's level as its Plan shows it: across skills, each skill's, and its checks. */
function toLanguage(language: LanguageProgressView | null) {
  if (!language) {
    return null;
  }

  return {
    // The view keeps the last units' checks and the current unit's.
    canDo: language.canDo.map((check) => ({ done: check.done, text: check.text })),
    level: language.level,
    skills: language.levels.map((level) => ({
      level: level.label,
      levelAtStart: level.startLabel,
      skill: level.skill,
      trend: level.trend,
    })),
    target: language.target?.label ?? null,
  };
}

/** The goal's progress as the Plan shows it, and a language goal's level. */
async function loadProgress(goal: Goal) {
  const [standing, language] = await Promise.all([
    getProgressView({ goalId: goal.id }),
    goal.kind === "language" ? getLanguageProgressView({ goalId: goal.id }) : null,
  ]);

  return {
    language: language?.status === "ready" ? language.progress : null,
    progress: standing.status === "ready" ? standing.progress : null,
  };
}

/**
 * Progress toward this goal as its Plan shows it: preparation, what's still needed by area (one
 * area with `area`, naming the areas when none matches), open mistakes and, for a language goal,
 * its level.
 */
export async function lookUpProgress({
  area,
  goal,
  scope,
}: Lookup): Promise<GoalTutorLookUpResult> {
  const what = "progress";
  const { language, progress } = await loadProgress(goal);

  if (!progress?.preparation && !language) {
    return { status: "notFound", what };
  }

  const allAreas = progress?.stillNeeded.areas ?? [];
  const areas = pickAreas({ area, areas: allAreas });

  if (!areas) {
    return {
      areas: allAreas.slice(0, MAX_AREAS).map((candidate) => candidate.title),
      moreAreas: Math.max(0, allAreas.length - MAX_AREAS),
      status: "notFound",
      what,
    };
  }

  return {
    language: toLanguage(language),
    link: toPageLink({ page: "plan", scope }) ?? toPageLink({ page: "stats", scope }),
    mistakes: { link: toPageLink({ page: "mistakes", scope }), open: progress?.mistakes.open ?? 0 },
    preparation: toPreparation(progress?.preparation),
    status: "found",
    stillNeeded: toStillNeeded(areas),
    what,
  };
}
