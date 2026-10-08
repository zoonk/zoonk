import "server-only";
import { type LanguageSkill, type LanguageSkillLevel, prisma } from "@zoonk/db";
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
 * Answers on a skill the level test didn't measure before it shows a level of its own: one typed
 * sentence says little about writing, a handful start to.
 */
const MIN_UNTESTED_ANSWERS = 5;

/** A skill's answers so far: its level moved with them, or its current window holds a handful. */
function hasEnoughEvidence(row: Pick<LanguageSkillLevel, "score" | "startScore" | "windowTotal">) {
  return row.score !== row.startScore || row.windowTotal >= MIN_UNTESTED_ANSWERS;
}

/**
 * Whether a skill has a level to show: a level the test gave it, or enough of the learner's own
 * answers. A test that didn't measure a skill (writing, or speaking when the sentence was skipped)
 * leaves it out until the learner's answers give it one (`hasEnoughEvidence`); before any test,
 * every skill shows the level the learner gave.
 */
function hasLevel({
  details,
  row,
  skill,
}: {
  details: Record<string, unknown>;
  row: LanguageSkillLevel | undefined;
  skill: LanguageSkill;
}): boolean {
  const tested = isJsonObject(details.skillLevels) ? details.skillLevels : null;

  return (
    !tested ||
    parseCefrScore(tested[skill]) !== null ||
    (row !== undefined && hasEnoughEvidence(row))
  );
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

    if (!hasLevel({ details, row, skill })) {
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

/**
 * The level the learner aims for ("B1+"), when they gave one: a target level, or the CEFR level
 * onboarding understood as a language goal's target (`targetScore`, such as "B2").
 */
export function getTargetLevel(
  details: Record<string, unknown>,
): { label: string; score: number } | null {
  const score = parseCefrScore(details.targetLevel) ?? parseCefrScore(details.targetScore);
  return score === null ? null : { label: formatCefrScore(score), score };
}
