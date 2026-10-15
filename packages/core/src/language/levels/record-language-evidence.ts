import "server-only";
import {
  type CourseLevel,
  type LanguageSkill,
  type StepKind,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
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

/** Evidence for one language skill's level, with the score a level that doesn't exist yet starts at. */
type SkillEvidence = {
  evidence: LevelEvidence;
  language: string;
  skill: LanguageSkill;
  startScore: number;
  userId: string;
};

/** The score a skill's level starts at: the learner's level test for the language, when they took it. */
async function loadStartScore({
  language,
  skill,
  userId,
}: {
  language: string;
  skill: LanguageSkill;
  userId: string;
}): Promise<number> {
  const goal = await findLearnerLanguageGoal({ targetLanguage: language, userId });
  return getStartScore({ details: readGoalDetails(goal), skill });
}

/**
 * Adds evidence to one skill's level in the caller's transaction. The row is created without
 * failing when another answer creates it first, then locked while it's read and written, so
 * answers given at the same moment each count once.
 */
async function addSkillEvidence(
  tx: TransactionClient,
  { evidence, language, skill, startScore, userId }: SkillEvidence,
): Promise<void> {
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
}

/** Adds evidence to one skill's level, in its own transaction (see `addSkillEvidence`). */
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
  const startScore = await loadStartScore({ language, skill, userId });

  // The level shows on the learner's language screens, so each answer raises their revision.
  await writeLearnerChange({ userId }, (tx) =>
    addSkillEvidence(tx, { evidence, language, skill, startScore, userId }),
  );
}

/**
 * What one answer in a language lesson says about the learner: evidence for the level of the skill
 * the screen trains, and a word learned when a word screen was right. Read before the answer is
 * recorded, so `writeLanguageStepEvidence` only writes.
 */
export type LanguageStepEvidence = {
  isCorrect: boolean;
  skill: SkillEvidence;
  word: { language: string; text: string; userId: string; wordId: string } | null;
};

/**
 * What one answer in a language lesson says about the learner (`LanguageStepEvidence`); null for
 * lessons of other subjects, which change nothing. Callers pass the user id their public capability
 * derived from the session.
 */
export async function loadLanguageStepEvidence({
  isCorrect,
  lesson,
  step,
  userId,
}: {
  isCorrect: boolean;
  lesson: { level: CourseLevel; targetLanguage: string | null };
  step: { kind: StepKind; wordId: string | null };
  userId: string;
}): Promise<LanguageStepEvidence | null> {
  const language = lesson.targetLanguage;
  const skill = getStepLanguageSkill(step.kind);

  if (!language || !skill) {
    return null;
  }

  const learnsWord = isCorrect && step.wordId !== null && WORD_STEP_KINDS.has(step.kind);

  const [startScore, word] = await Promise.all([
    loadStartScore({ language, skill, userId }),
    learnsWord && step.wordId
      ? prisma.word.findUnique({ select: { id: true, word: true }, where: { id: step.wordId } })
      : null,
  ]);

  return {
    isCorrect,
    skill: {
      evidence: { ceiling: getContentCeiling(lesson.level), correct: isCorrect ? 1 : 0, total: 1 },
      language,
      skill,
      startScore,
      userId,
    },
    word: word ? { language, text: word.word, userId, wordId: word.id } : null,
  };
}

/**
 * Writes an answer's language evidence in the transaction that records the answer, so the two
 * commit together. The word is remembered conflict-safe, so the same word answered right twice at
 * once is remembered once.
 */
export async function writeLanguageStepEvidence(
  tx: TransactionClient,
  { skill, word }: LanguageStepEvidence,
): Promise<void> {
  await addSkillEvidence(tx, skill);

  if (word) {
    await tx.learnerWord.createMany({ data: word, skipDuplicates: true });
  }
}

/** After a wrong answer's evidence is saved: a look for a pattern in recent mistakes. */
export function afterLanguageStepEvidence({ isCorrect, skill }: LanguageStepEvidence): void {
  if (!isCorrect) {
    scheduleMistakePatternCheck({ language: skill.language, userId: skill.userId });
  }
}

/**
 * Records what one answer in a language lesson says about the learner (`LanguageStepEvidence`)
 * in its own transaction, and after a wrong one, a look for a pattern in recent mistakes. Lessons of
 * other subjects change nothing. Callers pass the user id their public capability derived from the
 * session.
 */
export async function recordLanguageStepEvidence(
  input: Parameters<typeof loadLanguageStepEvidence>[0],
): Promise<void> {
  const evidence = await loadLanguageStepEvidence(input);

  if (!evidence) {
    return;
  }

  afterLanguageStepEvidence(evidence);

  await writeLearnerChange({ userId: evidence.skill.userId }, (tx) =>
    writeLanguageStepEvidence(tx, evidence),
  );
}
