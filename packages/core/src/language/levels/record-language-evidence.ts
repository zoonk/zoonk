import "server-only";
import {
  type CourseLevel,
  type LanguageSkill,
  type StepKind,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { findLearnerLanguageGoal, readGoalDetails } from "../_utils/language-goal";
import { isPatternCheckDue } from "../patterns/find-mistake-pattern";
import {
  type LevelEvidence,
  applyLevelEvidence,
  getContentCeiling,
  getStartScore,
  getStepLanguageSkill,
} from "./skill-level-rules";

const WORD_STEP_KINDS = new Set<StepKind>(["translation", "vocabulary"]);

export type SkillEvidence = {
  evidence: LevelEvidence;
  language: string;
  skill: LanguageSkill;
  startScore: number;
  userId: string;
};

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

export async function addSkillEvidence(
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

  const next = applyLevelEvidence(current, evidence);
  const raised = next.score > current.score;

  await tx.languageSkillLevel.update({
    data: { ...next, ...(raised && current.raisedAt === null && { raisedAt: new Date() }) },
    where: { id: current.id },
  });
}

/** Callers must derive `userId` from the authenticated session. */
export async function loadLanguageSkillEvidence({
  evidence,
  language,
  skill,
  userId,
}: Omit<SkillEvidence, "startScore">): Promise<SkillEvidence> {
  const startScore = await loadStartScore({ language, skill, userId });
  return { evidence, language, skill, startScore, userId };
}

export type LanguageStepEvidence = {
  isCorrect: boolean;
  skill: SkillEvidence;
  word: { language: string; text: string; userId: string; wordId: string } | null;
};

/** Callers must derive `userId` from the authenticated session. */
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

export async function writeLanguageStepEvidence(
  tx: TransactionClient,
  { isCorrect, skill, word }: LanguageStepEvidence,
): Promise<void> {
  await addSkillEvidence(tx, skill);

  if (word) {
    await tx.learnerWord.createMany({ data: word, skipDuplicates: true });
  }

  const { language, userId } = skill;

  if (!isCorrect && (await isPatternCheckDue({ db: tx, language, userId }))) {
    await oweFollowUps({
      db: tx,
      followUps: [{ input: { language }, kind: "findMistakePattern" }],
      userId,
    });
  }
}
