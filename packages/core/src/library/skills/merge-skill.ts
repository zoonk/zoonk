import "server-only";
import { type LearnerSkill, type Skill, type TransactionClient, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getLearnerModelCacheTag,
  getLibraryLessonCacheTag,
  getSkillCacheTag,
} from "../../cache/tags";
import { getAdminAccess } from "../../users/get-admin-access";
import { findSurvivingSkill } from "./_utils/find-surviving-skill";

export type SkillMergeResult =
  | { learners: number; status: "merged"; survivorId: string }
  | { status: "forbidden" | "invalid" | "notFound" | "unauthorized" };

type SkillPair = { duplicate: Skill; survivor: Skill };

/**
 * Two skills can only become one when a learner of either would see the same thing: the same
 * language pair, and the same audience (both public, or private to the same learner).
 */
function canMerge({ duplicate, survivor }: SkillPair): boolean {
  return (
    duplicate.id !== survivor.id &&
    duplicate.mergedIntoId === null &&
    duplicate.language === survivor.language &&
    duplicate.targetLanguage === survivor.targetLanguage &&
    duplicate.visibility === survivor.visibility &&
    duplicate.ownerId === survivor.ownerId
  );
}

/** A learner who has both skills keeps the row with more reviews behind it. */
function keepsDuplicateRow({
  duplicate,
  survivor,
}: {
  duplicate: LearnerSkill;
  survivor: LearnerSkill;
}) {
  return duplicate.reps > survivor.reps;
}

/**
 * Moves every learner's mastery to the survivor. A learner with rows on both keeps the one with
 * more reviews, so nobody's schedule restarts; the unique key allows one row per skill.
 */
async function moveLearnerSkills(tx: TransactionClient, { duplicate, survivor }: SkillPair) {
  const rows = await tx.learnerSkill.findMany({ where: { skillId: duplicate.id } });

  const survivorRows = await tx.learnerSkill.findMany({
    where: { skillId: survivor.id, userId: { in: rows.map((row) => row.userId) } },
  });

  const survivorRowByUser = new Map(survivorRows.map((row) => [row.userId, row]));

  const replaced = rows.flatMap((row) => {
    const existing = survivorRowByUser.get(row.userId);
    return existing && keepsDuplicateRow({ duplicate: row, survivor: existing }) ? [existing] : [];
  });

  const dropped = rows.filter((row) => {
    const existing = survivorRowByUser.get(row.userId);
    return existing && !keepsDuplicateRow({ duplicate: row, survivor: existing });
  });

  await tx.learnerSkill.deleteMany({
    where: { id: { in: [...replaced, ...dropped].map((row) => row.id) } },
  });

  await tx.learnerSkill.updateMany({
    data: { skillId: survivor.id },
    where: { skillId: duplicate.id },
  });

  return rows.map((row) => row.userId);
}

/** Answers, mistakes, plan steps, questions and screens now train the survivor. */
async function movePointers(tx: TransactionClient, { duplicate, survivor }: SkillPair) {
  const move = { data: { skillId: survivor.id }, where: { skillId: duplicate.id } };

  await Promise.all([
    tx.attempt.updateMany(move),
    tx.mistake.updateMany(move),
    tx.planItem.updateMany(move),
    tx.item.updateMany(move),
    tx.step.updateMany(move),
  ]);
}

/** Lessons, chapters and graph edges that named the duplicate name the survivor, without self-loops. */
async function moveLinks(tx: TransactionClient, { duplicate, survivor }: SkillPair) {
  const [lessonLinks, chapterLinks, prerequisites, dependents] = await Promise.all([
    tx.lessonSkill.findMany({ where: { skillId: duplicate.id } }),
    tx.chapterSkill.findMany({ where: { skillId: duplicate.id } }),
    tx.skillPrerequisite.findMany({ where: { skillId: duplicate.id } }),
    tx.skillPrerequisite.findMany({ where: { prerequisiteId: duplicate.id } }),
  ]);

  const edges = [
    ...prerequisites.map((edge) => ({ prerequisiteId: edge.prerequisiteId, skillId: survivor.id })),
    ...dependents.map((edge) => ({ prerequisiteId: survivor.id, skillId: edge.skillId })),
  ].filter((edge) => edge.prerequisiteId !== edge.skillId);

  await Promise.all([
    tx.lessonSkill.createMany({
      data: lessonLinks.map((link) => ({ lessonId: link.lessonId, skillId: survivor.id })),
      skipDuplicates: true,
    }),
    tx.chapterSkill.createMany({
      data: chapterLinks.map((link) => ({ chapterId: link.chapterId, skillId: survivor.id })),
      skipDuplicates: true,
    }),
    tx.skillPrerequisite.createMany({ data: edges, skipDuplicates: true }),
  ]);

  await Promise.all([
    tx.lessonSkill.deleteMany({ where: { skillId: duplicate.id } }),
    tx.chapterSkill.deleteMany({ where: { skillId: duplicate.id } }),
    tx.skillPrerequisite.deleteMany({
      where: { OR: [{ skillId: duplicate.id }, { prerequisiteId: duplicate.id }] },
    }),
  ]);

  return lessonLinks.map((link) => link.lessonId);
}

async function mergeInto(pair: SkillPair) {
  return prisma.$transaction(async (tx) => {
    const userIds = await moveLearnerSkills(tx, pair);
    await movePointers(tx, pair);
    const lessonIds = await moveLinks(tx, pair);

    await tx.skill.updateMany({
      data: { mergedIntoId: pair.survivor.id },
      where: { OR: [{ id: pair.duplicate.id }, { mergedIntoId: pair.duplicate.id }] },
    });

    return { lessonIds, userIds };
  });
}

/**
 * Merges a duplicate skill that slipped past identity search into the skill that survives. Skills
 * are never deleted: the duplicate points at the survivor, and learners' mastery, answers,
 * mistakes and plans, and the lessons, questions and prerequisites that named it, move over, so a
 * learner's progress follows the one skill everyone shares. Merging into a skill that was itself
 * merged goes to where that one points. Only admins may do this.
 */
export async function mergeSkillForAdmin({
  duplicateId,
  survivorId,
}: {
  duplicateId: string;
  survivorId: string;
}): Promise<SkillMergeResult> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!isUuid(duplicateId) || !isUuid(survivorId)) {
    return { status: "notFound" };
  }

  const [duplicate, found] = await Promise.all([
    prisma.skill.findUnique({ where: { id: duplicateId } }),
    findSurvivingSkill(survivorId),
  ]);

  if (!duplicate || !found) {
    return { status: "notFound" };
  }

  const pair = { duplicate, survivor: found.skill };

  if (found.visitedIds.includes(duplicate.id) || !canMerge(pair)) {
    return { status: "invalid" };
  }

  const { lessonIds, userIds } = await mergeInto(pair);

  revalidateCacheTags([
    getSkillCacheTag(duplicate.id),
    getSkillCacheTag(pair.survivor.id),
    ...userIds.map((userId) => getLearnerModelCacheTag(userId)),
    ...lessonIds.map((lessonId) => getLibraryLessonCacheTag(lessonId)),
  ]);

  return { learners: userIds.length, status: "merged", survivorId: pair.survivor.id };
}
