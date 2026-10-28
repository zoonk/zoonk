import { type TransactionClient, prisma } from "@zoonk/db";
import { type SkillReview } from "../answer-events";
import { type GradedAnswer } from "../answer-rating";
import { reviewSkillMemory } from "../fsrs-scheduler";

const MAX_CONCURRENT_RETRIES = 3;

type SkillAnswer = {
  answer: GradedAnswer;
  /** An answer while learning, not a diagnostic: see `reviewSkillMemory`. */
  learning: boolean;
  reviewedAt: Date;
  skillId: string;
  timeZone: string;
  userId: string;
};

/** Maps merged skills to their survivor and unmerged skills to themselves. */
export async function loadSkillSurvivors(
  skillIds: readonly string[],
  transaction: TransactionClient = prisma,
): Promise<(skillId: string) => string> {
  const survivors = await loadSkillSurvivorMap(skillIds, transaction);
  return (skillId) => survivors.get(skillId) ?? skillId;
}

export async function loadSkillSurvivorMap(
  skillIds: readonly string[],
  transaction: TransactionClient = prisma,
): Promise<Map<string, string>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const merged = await transaction.skill.findMany({
    select: { id: true, mergedIntoId: true },
    where: { id: { in: [...skillIds] }, mergedIntoId: { not: null } },
  });

  return new Map(merged.map((skill) => [skill.id, skill.mergedIntoId ?? skill.id]));
}

async function getOrCreateLearnerSkill({
  skillId,
  transaction,
  userId,
}: {
  skillId: string;
  transaction: TransactionClient;
  userId: string;
}) {
  await transaction.learnerSkill.createMany({ data: [{ skillId, userId }], skipDuplicates: true });
  return transaction.learnerSkill.findUniqueOrThrow({ where: { userSkill: { skillId, userId } } });
}

async function applyWithRetries({
  retriesLeft,
  transaction,
  ...input
}: SkillAnswer & { retriesLeft: number; transaction: TransactionClient }): Promise<SkillReview> {
  const current = await getOrCreateLearnerSkill({ ...input, transaction });

  const next = reviewSkillMemory({
    answer: input.answer,
    learning: input.learning,
    memory: current,
    reviewedAt: input.reviewedAt,
    timeZone: input.timeZone,
  });

  const { count } = await transaction.learnerSkill.updateMany({
    data: next,
    where: { id: current.id, reps: current.reps },
  });

  if (count === 1) {
    return { after: { ...current, ...next }, before: current };
  }

  if (retriesLeft === 0) {
    throw new Error(`Could not update learner skill ${input.skillId} after concurrent answers.`);
  }

  return applyWithRetries({ ...input, retriesLeft: retriesLeft - 1, transaction });
}

/** Applies concurrent answers without overwriting memory; returns the before/after pair for this answer only. */
export function applyAnswerToLearnerSkill(
  input: SkillAnswer,
  transaction: TransactionClient = prisma,
): Promise<SkillReview> {
  return applyWithRetries({ ...input, retriesLeft: MAX_CONCURRENT_RETRIES, transaction });
}
