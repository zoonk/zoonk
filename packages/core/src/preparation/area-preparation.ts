import { type SkillStateCounts, countSkillStates } from "../learner/mastery-state";
import {
  type PreparationSkill,
  type UnseenAnswer,
  getPreparationComponents,
  getPreparationValue,
} from "./preparation-math";

/** One area of a goal (a subject area or chapter) and how prepared the learner is in it. */
export type AreaPreparation = {
  areaId: string;
  /** Studied, but fading or not yet well known: where practice pays. */
  needsPractice: boolean;
  preparation: number;
  skills: SkillStateCounts;
  title: string;
  weekGain: number;
};

/** Below this share of the studied part known well, an area needs practice. */
const NEEDS_PRACTICE_QUALITY = 0.7;

type AreaMeasure = AreaPreparation & { coverage: number; quality: number | null };

function measureArea({
  answers,
  area,
  now,
  skills,
  weekAgo,
}: {
  answers: readonly UnseenAnswer[];
  area: { areaId: string; title: string };
  now: Date;
  skills: readonly PreparationSkill[];
  weekAgo: Date;
}): AreaMeasure {
  const areaSkills = skills.filter((skill) => skill.areaId === area.areaId);
  const skillIds = new Set(areaSkills.map((skill) => skill.skillId));
  const areaAnswers = answers.filter((answer) => skillIds.has(answer.skillId));

  const measure = (asOf: Date) =>
    getPreparationComponents({ answers: areaAnswers, asOf, mocks: [], skills: areaSkills });

  const components = measure(now);
  const preparation = getPreparationValue(components, { needsTest: false });
  const coverage = components.coverage.value;
  const quality = coverage > 0 ? preparation / coverage : null;
  const counts = countSkillStates(areaSkills);

  return {
    ...area,
    coverage,
    needsPractice: counts.fading > 0 || (quality !== null && quality < NEEDS_PRACTICE_QUALITY),
    preparation,
    quality,
    skills: counts,
    weekGain: preparation - getPreparationValue(measure(weekAgo), { needsTest: false }),
  };
}

/**
 * Measures each area with the same math as the whole goal (mocks aside, since they span areas) and
 * names the weakest studied area, which gets the "Practice now" shortcut. Areas not reached yet
 * are never the weakest: being early in the plan isn't a weakness.
 */
export function getAreaPreparations({
  answers,
  areas,
  now,
  skills,
  weekAgo,
}: {
  answers: readonly UnseenAnswer[];
  areas: readonly { areaId: string; title: string }[];
  now: Date;
  skills: readonly PreparationSkill[];
  weekAgo: Date;
}): { areas: AreaPreparation[]; weakestAreaId: string | null } {
  const measured = areas.map((area) => measureArea({ answers, area, now, skills, weekAgo }));

  const weakest = measured
    .filter((area) => area.quality !== null)
    .toSorted((a, b) => (a.quality ?? 0) - (b.quality ?? 0) || a.preparation - b.preparation)[0];

  return {
    areas: measured.map((area) => ({
      areaId: area.areaId,
      needsPractice: area.needsPractice,
      preparation: area.preparation,
      skills: area.skills,
      title: area.title,
      weekGain: area.weekGain,
    })),
    weakestAreaId: weakest?.areaId ?? null,
  };
}
