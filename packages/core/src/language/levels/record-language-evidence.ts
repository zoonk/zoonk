import "server-only";
import {
  type CourseLevel,
  type LanguageSkill,
  type StepKind,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { usesNonLatinScript } from "@zoonk/utils/languages";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { findLearnerLanguageGoal, readGoalDetails } from "../_utils/language-goal";
import { scheduleMistakePatternCheck } from "../patterns/find-mistake-pattern";
import {
  type LevelEvidence,
  applyLevelEvidence,
  getContentCeiling,
  getStartScore,
  getStepLanguageSkill,
} from "./skill-level-rules";

const MAX_EVIDENCE_ATTEMPTS = 3;

class EvidenceAdmissionChangedError extends Error {
  override name = "EvidenceAdmissionChangedError";
}

const WORD_STEP_KINDS = new Set<StepKind>(["translation", "vocabulary"]);

type SkillEvidence = {
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

async function changesSelection(tx: TransactionClient, input: SkillEvidence): Promise<boolean> {
  if (input.skill !== "reading" || !usesNonLatinScript(input.language)) {
    return false;
  }

  const current = await tx.languageSkillLevel.findUnique({
    where: {
      userLanguageSkill: { language: input.language, skill: input.skill, userId: input.userId },
    },
  });

  const state = current ?? {
    score: input.startScore,
    startScore: input.startScore,
    windowCeiling: null,
    windowCorrect: 0,
    windowTotal: 0,
  };

  return applyLevelEvidence(state, input.evidence).score !== (current?.score ?? 0);
}

async function writeEvidence({
  attempt = 1,
  skill,
  write,
}: {
  attempt?: number;
  skill: SkillEvidence;
  write: (tx: TransactionClient) => Promise<void>;
}): Promise<void> {
  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const planInputs = await changesSelection(tx, skill);
      await markLearnerChanged(tx, { planInputs, userId: skill.userId });

      if (planInputs !== (await changesSelection(tx, skill))) {
        throw new EvidenceAdmissionChangedError();
      }

      await write(tx);
    }),
  );

  if (error instanceof EvidenceAdmissionChangedError && attempt < MAX_EVIDENCE_ATTEMPTS) {
    return writeEvidence({ attempt: attempt + 1, skill, write });
  }

  if (error) {
    throw error;
  }
}

/** Internal: the caller must derive `userId` from the authenticated session. */
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

  const input = { evidence, language, skill, startScore, userId };
  await writeEvidence({ skill: input, write: (tx) => addSkillEvidence(tx, input) });
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
  { skill, word }: LanguageStepEvidence,
): Promise<void> {
  await addSkillEvidence(tx, skill);

  if (word) {
    await tx.learnerWord.createMany({ data: word, skipDuplicates: true });
  }
}

export function afterLanguageStepEvidence({ isCorrect, skill }: LanguageStepEvidence): void {
  if (!isCorrect) {
    scheduleMistakePatternCheck({ language: skill.language, userId: skill.userId });
  }
}

/** Callers must derive `userId` from the authenticated session. */
export async function recordLanguageStepEvidence(
  input: Parameters<typeof loadLanguageStepEvidence>[0],
): Promise<void> {
  const evidence = await loadLanguageStepEvidence(input);

  if (!evidence) {
    return;
  }

  afterLanguageStepEvidence(evidence);

  await writeEvidence({
    skill: evidence.skill,
    write: (tx) => writeLanguageStepEvidence(tx, evidence),
  });
}
