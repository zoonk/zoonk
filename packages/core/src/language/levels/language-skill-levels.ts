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

export type LanguageSkillLevelView = {
  label: string;
  /** Half steps from A1 (0) to C2 (5), for the bar. */
  score: number;
  skill: LanguageSkill;
  startLabel: string;
  trend: LevelTrend;
};

const MIN_UNTESTED_ANSWERS = 5;

function hasEnoughEvidence(row: Pick<LanguageSkillLevel, "score" | "startScore" | "windowTotal">) {
  return row.score !== row.startScore || row.windowTotal >= MIN_UNTESTED_ANSWERS;
}

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

export function getTargetLevel(
  details: Record<string, unknown>,
): { label: string; score: number } | null {
  const score = parseCefrScore(details.targetLevel) ?? parseCefrScore(details.targetScore);
  return score === null ? null : { label: formatCefrScore(score), score };
}
