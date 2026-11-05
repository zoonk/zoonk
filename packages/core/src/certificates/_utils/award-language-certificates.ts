import "server-only";
import { issueEarnedCertificates } from "@zoonk/auth/certificate-issuance";
import { type Goal, type LanguageSkill, type TransactionClient } from "@zoonk/db";
import { formatCefrScore } from "@zoonk/utils/cefr";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findLearnerLanguageGoal } from "../../language/_utils/language-goal";
import { getEarnedLanguageLevel, getFinishedBands } from "../../language/levels/skill-level-rules";
import { loadDoneUnitIds } from "../../language/units/can-do-events";
import { loadLanguageUnits } from "../../language/units/language-units";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { countLessons } from "../../plans/_utils/stand-in-lessons";
import { type CertifiedLevel, type LanguageLevelCertificateDetails } from "../certificate-contract";
import { createCertificateCode } from "./certificate-code";

type SkillScore = { score: number; skill: LanguageSkill };

function getLevelKey({ language, level }: { language: string; level: CertifiedLevel }): string {
  return `${language}:${level}`;
}

function toSkillLabels(skills: readonly SkillScore[]) {
  return skills.map(({ score, skill }) => ({ label: formatCefrScore(score), skill }));
}

function getCompletedOn({ goal, now }: { goal: Pick<Goal, "timezone"> | null; now: Date }) {
  return getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal }) });
}

async function loadGoalStudy(tx: TransactionClient, goal: Goal) {
  const [units, studied] = await Promise.all([
    loadLanguageUnits(goal, tx),
    tx.planItem.findMany({
      select: {
        chapterId: true,
        kind: true,
        lessonId: true,
        lessons: true,
        minutes: true,
        skillId: true,
      },
      where: { kind: "lesson", plan: { goalId: goal.id }, status: "done" },
    }),
  ]);

  const doneIds = await loadDoneUnitIds({ db: tx, units, userId: goal.userId });
  const minutes = studied.map((item) => item.minutes);

  return {
    canDo: units.filter((unit) => doneIds.has(unit.chapterId)).flatMap((unit) => unit.objectives),
    lessonsStudied: countLessons(studied),
    minutes: minutes.includes(null)
      ? null
      : Math.round(minutes.reduce((sum: number, value) => sum + (value ?? 0), 0)),
  };
}

async function buildLevelDetails({
  goal,
  skills,
  tx,
}: {
  goal: Goal | null;
  skills: readonly SkillScore[];
  tx: TransactionClient;
}): Promise<LanguageLevelCertificateDetails> {
  const study = goal
    ? await loadGoalStudy(tx, goal)
    : { canDo: [], lessonsStudied: 0, minutes: null };

  return { ...study, skillLevels: toSkillLabels(skills) };
}

/**
 * Called after evidence raised a skill: awards each band the learner's earned level just crossed,
 * once per language and band. "Before" counts the raised skill at its previous score, which covers
 * its first raise.
 */
export async function awardLanguageLevelCertificates(
  tx: TransactionClient,
  {
    language,
    now,
    previous,
    userId,
  }: { language: string; now: Date; previous: SkillScore; userId: string },
): Promise<void> {
  const rows = await tx.languageSkillLevel.findMany({ where: { language, userId } });
  const after = getEarnedLanguageLevel(rows);

  const before = getEarnedLanguageLevel(
    rows.map((row) =>
      row.skill === previous.skill ? { raisedAt: now, score: previous.score } : row,
    ),
  );

  if (after === null || before === null) {
    return;
  }

  const bands = getFinishedBands({ after, before });

  if (bands.length === 0) {
    return;
  }

  const held = await tx.certificate.findMany({
    select: { key: true },
    where: {
      key: { in: bands.map((level) => getLevelKey({ language, level })) },
      kind: "languageLevel",
      userId,
    },
  });

  const keys = new Set(held.map((row) => row.key));
  const due = bands.filter((level) => !keys.has(getLevelKey({ language, level })));

  if (due.length === 0) {
    return;
  }

  const goal = await findLearnerLanguageGoal({ db: tx, targetLanguage: language, userId });
  const counted = rows.filter((row) => row.raisedAt !== null);
  const details = await buildLevelDetails({ goal, skills: counted, tx });

  await tx.certificate.createMany({
    data: due.map((level) => ({
      code: createCertificateCode(),
      completedOn: getCompletedOn({ goal, now }),
      details,
      goalId: goal?.id ?? null,
      key: getLevelKey({ language, level }),
      kind: "languageLevel" as const,
      language: goal?.language ?? DEFAULT_LOCALE,
      level,
      targetLanguage: language,
      userId,
    })),
  });

  await issueEarnedCertificates(tx, { now, plus: "check", userId });
}
