import "server-only";
import { type Lesson, type TransactionClient, prisma } from "@zoonk/db";
import { isVisibleTo } from "../_utils/library-visibility";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { findSurvivingSkill } from "../skills/_utils/find-surviving-skill";
import { SECOND_TAKE_MINUTES, getSecondTakeIdentityKey } from "./second-take-identity";
import { findSecondTakeSource } from "./second-take-source";

function lessonToWrite(lesson: Pick<Lesson, "contentStatus" | "id" | "setAsideAt">) {
  return ["completed", "failed"].includes(lesson.contentStatus) || lesson.setAsideAt
    ? null
    : lesson.id;
}

async function readSecondTake({
  db,
  skillId,
  userId,
}: {
  db: TransactionClient;
  skillId: string;
  userId: string;
}) {
  const found = await findSurvivingSkill(skillId, db);
  const skill = found?.skill;

  if (!skill || skill.mergedIntoId || !isVisibleTo({ row: skill, viewerId: userId })) {
    return null;
  }

  const ownerId = skill.visibility === "private" ? userId : null;
  const identityKey = getSecondTakeIdentityKey({ ownerId, skillId: skill.id });

  const existing = await db.lesson.findUnique({
    select: { contentStatus: true, id: true, setAsideAt: true },
    where: { languageIdentity: { identityKey, language: skill.language } },
  });

  if (existing) {
    return { existing: lessonToWrite(existing) };
  }

  const source = await findSecondTakeSource({
    db,
    language: skill.language,
    ownerId,
    skillId: skill.id,
  });

  return source ? { identityKey, ownerId, skill, source } : null;
}

/** Internal workflow bridge. The follow-up must be owed by the learner's day-opening write. */
export async function ensureSecondTake({ skillId, userId }: { skillId: string; userId: string }) {
  const found = await prisma.$transaction((db) => readSecondTake({ db, skillId, userId }), {
    isolationLevel: "RepeatableRead",
  });

  if (!found || "existing" in found) {
    return found?.existing ?? null;
  }

  const { identityKey, ownerId, skill, source } = found;

  const { lesson } = await createLibraryLesson({
    canDo: source.canDo,
    description: source.description,
    estimatedMinutes: SECOND_TAKE_MINUTES,
    homeChapterId: null,
    identityKey,
    language: skill.language,
    level: source.level,
    ownerId,
    provenance: {
      generatedAt: new Date(),
      model: "pending",
      promptVersion: "pending",
      runId: "pending",
    },
    skillIds: [skill.id],
    targetLanguage: skill.targetLanguage,
    title: source.title,
  });

  return lessonToWrite(lesson);
}
