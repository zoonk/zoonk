import "server-only";
import { type LanguageSkill, prisma } from "@zoonk/db";
import { formatCefrScore, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import {
  LANGUAGE_SKILLS,
  type LevelTrend,
  getLevelTrend,
  getStartScore,
} from "./skill-level-rules";

/** One skill's level as learners see it: "B1", up since the level test. */
export type LanguageSkillLevelView = {
  label: string;
  /** Half steps from A1 (0) to C2 (5), for the bar. */
  score: number;
  skill: LanguageSkill;
  startLabel: string;
  trend: LevelTrend;
};

/**
 * Whether a skill has a level to show: evidence from lessons, or a level the test gave it. A test
 * that didn't measure a skill (speaking, when the sentence was skipped) leaves it out until the
 * learner's answers give it one; before any test, every skill shows the level the learner gave.
 */
function hasLevel({
  details,
  hasEvidence,
  skill,
}: {
  details: Record<string, unknown>;
  hasEvidence: boolean;
  skill: LanguageSkill;
}): boolean {
  const tested = isJsonObject(details.skillLevels) ? details.skillLevels : null;
  return hasEvidence || !tested || parseCefrScore(tested[skill]) !== null;
}

/**
 * The learner's level in each skill of a language. Skills with no evidence yet show where the
 * level test or the learner's own answer put them.
 */
export async function loadLanguageSkillLevels({
  details,
  language,
  userId,
}: {
  details: Record<string, unknown>;
  language: string;
  userId: string;
}): Promise<LanguageSkillLevelView[]> {
  const rows = await prisma.languageSkillLevel.findMany({ where: { language, userId } });

  return LANGUAGE_SKILLS.flatMap((skill) => {
    const row = rows.find((item) => item.skill === skill);

    if (!hasLevel({ details, hasEvidence: Boolean(row), skill })) {
      return [];
    }

    const startScore = row?.startScore ?? getStartScore({ details, skill });
    const score = row?.score ?? startScore;

    return {
      label: formatCefrScore(score),
      score,
      skill,
      startLabel: formatCefrScore(startScore),
      trend: getLevelTrend({ score, startScore }),
    };
  });
}

/** The level the learner aims for ("B1+"), when they gave one. */
export function getTargetLevel(
  details: Record<string, unknown>,
): { label: string; score: number } | null {
  const score = parseCefrScore(details.targetLevel);
  return score === null ? null : { label: formatCefrScore(score), score };
}
