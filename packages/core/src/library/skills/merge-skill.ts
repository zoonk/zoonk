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
import { writePlanInputs } from "../_utils/plan-input-write";
import { findSurvivingSkill } from "./_utils/find-surviving-skill";
import { lockSkillPlanInputs } from "./_utils/skill-input-write";

export type SkillMergeResult =
  | { learners: number; status: "merged"; survivorId: string }
  | { status: "forbidden" | "invalid" | "notFound" | "unauthorized" };

type SkillPair = { duplicate: Skill; survivor: Skill };

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

function keepsDuplicateRow({
  duplicate,
  survivor,
}: {
  duplicate: LearnerSkill;
  survivor: LearnerSkill;
}) {
  return duplicate.reps > survivor.reps;
}

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
  return writePlanInputs(async (tx) => {
    await lockSkillPlanInputs({
      masterySkillId: pair.duplicate.id,
      skillIds: [pair.duplicate.id, pair.survivor.id],
      tx,
    });

    const [duplicate, survivor] = await Promise.all([
      tx.skill.findUniqueOrThrow({ where: { id: pair.duplicate.id } }),
      tx.skill.findUniqueOrThrow({ where: { id: pair.survivor.id } }),
    ]);

    if (!canMerge({ duplicate, survivor }) || survivor.mergedIntoId !== null) {
      throw new Error("A skill was merged meanwhile; try the merge again.");
    }

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
