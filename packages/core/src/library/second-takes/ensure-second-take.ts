import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { SECOND_TAKE_MINUTES, getSecondTakeIdentityKey } from "./second-take-identity";
import { findSecondTakeSource } from "./second-take-source";

function lessonToWrite(lesson: Pick<Lesson, "contentStatus" | "id" | "setAsideAt">) {
  return ["completed", "failed"].includes(lesson.contentStatus) || lesson.setAsideAt
    ? null
    : lesson.id;
}

/** Internal workflow bridge. The follow-up must be owed by the learner's day-opening write. */
export async function ensureSecondTake({ skillId, userId }: { skillId: string; userId: string }) {
  const skill = await prisma.skill.findFirst({
    select: { language: true, ownerId: true, targetLanguage: true, visibility: true },
    where: { ...libraryRowsVisibleTo(userId), id: skillId, mergedIntoId: null },
  });

  if (!skill || (skill.visibility === "private" && skill.ownerId !== userId)) {
    return null;
  }

  const ownerId = skill.visibility === "private" ? userId : null;
  const identityKey = getSecondTakeIdentityKey({ ownerId, skillId });

  const existing = await prisma.lesson.findUnique({
    select: { contentStatus: true, id: true, setAsideAt: true },
    where: { languageIdentity: { identityKey, language: skill.language } },
  });

  if (existing) {
    return lessonToWrite(existing);
  }

  const source = await findSecondTakeSource({ language: skill.language, ownerId, skillId });

  if (!source) {
    return null;
  }

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
    skillIds: [skillId],
    targetLanguage: skill.targetLanguage,
    title: source.title,
  });

  return lessonToWrite(lesson);
}
