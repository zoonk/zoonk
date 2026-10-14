import { type TransactionClient, prisma } from "@zoonk/db";
import { type SkillReview } from "../answer-events";
import { type GradedAnswer } from "../answer-rating";
import { reviewSkillMemory } from "../fsrs-scheduler";

/** Two answers on one skill rarely land together; a few retries always settle them. */
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

/**
 * Skills are merged, never deleted, and a merged skill's learner rows and lessons move to the
 * survivor. Content that still points at a merged skill reads the survivor instead: the returned
 * function maps each skill to its survivor, or to itself.
 */
export async function loadSkillSurvivors(
  skillIds: readonly string[],
  transaction: TransactionClient = prisma,
): Promise<(skillId: string) => string> {
  const survivors = await loadSkillSurvivorMap(skillIds, transaction);
  return (skillId) => survivors.get(skillId) ?? skillId;
}

/** Each merged skill of `skillIds` with its survivor (see `loadSkillSurvivors`). */
export async function loadSkillSurvivorMap(
  skillIds: readonly string[],
  transaction: TransactionClient = prisma,
): Promise<Map<string, string>> {
  const merged = await transaction.skill.findMany({
    select: { id: true, mergedIntoId: true },
    where: { id: { in: [...skillIds] }, mergedIntoId: { not: null } },
  });

  return new Map(merged.map((skill) => [skill.id, skill.mergedIntoId ?? skill.id]));
}

/**
 * Reads the learner's row for a skill, creating it as New the first time. The insert skips an
 * existing row, so two first answers at once never collide on the unique key.
 */
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

/**
 * Applies one graded answer to the learner's FSRS memory of a skill. Every review adds a rep, so
 * the write only lands when `reps` still matches what was read: two answers on the same skill at
 * once are applied one after the other instead of one overwriting the other. Returns the memory
 * the answer was applied to and the result, so each change is reported once.
 */
export function applyAnswerToLearnerSkill(
  input: SkillAnswer,
  transaction: TransactionClient = prisma,
): Promise<SkillReview> {
  return applyWithRetries({ ...input, retriesLeft: MAX_CONCURRENT_RETRIES, transaction });
}
