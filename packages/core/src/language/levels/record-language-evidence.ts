import "server-only";
import { type CourseLevel, type LanguageSkill, type StepKind, prisma } from "@zoonk/db";
import { findLearnerLanguageGoal, readGoalDetails } from "../_utils/language-goal";
import { scheduleMistakePatternCheck } from "../patterns/find-mistake-pattern";
import {
  type LevelEvidence,
  applyLevelEvidence,
  getContentCeiling,
  getStartScore,
  getStepLanguageSkill,
} from "./skill-level-rules";

/** Screens that teach a word: a right answer means the learner knows it. */
const WORD_STEP_KINDS = new Set<StepKind>(["translation", "vocabulary"]);

/**
 * Adds evidence to one skill's level. The row is created without failing when another answer
 * creates it first, then locked while it's read and written, so answers given at the same moment
 * each count once.
 */
export async function recordLanguageSkillEvidence({
  evidence,
  language,
  skill,
  userId,
}: {
  evidence: LevelEvidence;
  language: string;
  skill: LanguageSkill;
  userId: string;
}): Promise<void> {
  const goal = await findLearnerLanguageGoal({ targetLanguage: language, userId });
  const details = readGoalDetails(goal);
  const startScore = getStartScore({ details, skill });

  await prisma.$transaction(async (tx) => {
    // `INSERT ... ON CONFLICT DO NOTHING`: an upsert with nothing to update isn't a database upsert
    // in Prisma, so two first answers would both try to create the row.
    await tx.languageSkillLevel.createMany({
      data: { language, score: startScore, skill, startScore, userId },
      skipDuplicates: true,
    });

    await tx.$queryRaw`
      SELECT "id" FROM "language_skill_levels"
      WHERE "user_id" = ${userId}::uuid
        AND "language" = ${language}
        AND "skill" = ${skill}::"LanguageSkill"
      FOR UPDATE
    `;

    const current = await tx.languageSkillLevel.findUniqueOrThrow({
      where: { userLanguageSkill: { language, skill, userId } },
    });

    await tx.languageSkillLevel.update({
      data: applyLevelEvidence(current, evidence),
      where: { id: current.id },
    });
  });
}

async function rememberWord({
  language,
  userId,
  wordId,
}: {
  language: string;
  userId: string;
  wordId: string;
}) {
  const word = await prisma.word.findUnique({ select: { word: true }, where: { id: wordId } });

  if (!word) {
    return;
  }

  // Conflict-safe, so the same word answered right twice at once is remembered once.
  await prisma.learnerWord.createMany({
    data: { language, text: word.word, userId, wordId },
    skipDuplicates: true,
  });
}

/**
 * Records what one answer in a language lesson says about the learner: evidence for the level of
 * the skill the screen trains, a word learned when a word screen was right, and after a wrong one,
 * a look for a pattern in recent mistakes. Lessons of other subjects change nothing. Callers pass
 * the user id their public capability derived from the session.
 */
export async function recordLanguageStepEvidence({
  isCorrect,
  lesson,
  step,
  userId,
}: {
  isCorrect: boolean;
  lesson: { level: CourseLevel; targetLanguage: string | null };
  step: { kind: StepKind; wordId: string | null };
  userId: string;
}): Promise<void> {
  const language = lesson.targetLanguage;
  const skill = getStepLanguageSkill(step.kind);

  if (!language || !skill) {
    return;
  }

  const learnsWord = isCorrect && step.wordId !== null && WORD_STEP_KINDS.has(step.kind);

  if (!isCorrect) {
    scheduleMistakePatternCheck({ language, userId });
  }

  await Promise.all([
    recordLanguageSkillEvidence({
      evidence: { ceiling: getContentCeiling(lesson.level), correct: isCorrect ? 1 : 0, total: 1 },
      language,
      skill,
      userId,
    }),
    learnsWord && step.wordId ? rememberWord({ language, userId, wordId: step.wordId }) : null,
  ]);
}
