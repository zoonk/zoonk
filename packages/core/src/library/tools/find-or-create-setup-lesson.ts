import "server-only";
import { generateSetupLessonOutline } from "@zoonk/ai/tasks/v2/curriculum/setup-lesson-outline";
import { prisma } from "@zoonk/db";
import {
  buildLessonIdentityKey,
  buildSetupSkillIdentityKey,
  scopeIdentityKey,
} from "@zoonk/utils/identity-key";
import { type CurriculumAnalytics } from "../curriculum/curriculum-scope";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { createSkill } from "../skills/create-skill";

const SETUP_LEVEL = "beginner";

export type SetupLesson = { lessonId: string; skillId: string; title: string };

async function findSetupLesson({
  identityKey,
  language,
}: {
  identityKey: string;
  language: string;
}): Promise<SetupLesson | null> {
  const skill = await prisma.skill.findUnique({
    include: {
      lessons: {
        include: { lesson: { select: { id: true, title: true } } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    where: { languageIdentity: { identityKey, language } },
  });

  const lesson = skill?.lessons[0]?.lesson;

  return skill && lesson ? { lessonId: lesson.id, skillId: skill.id, title: lesson.title } : null;
}

/** Internal workflow bridge: derive the owner from the authenticated public boundary. */
export async function findOrCreateSetupLesson({
  analytics,
  language,
  ownerId,
  system,
  tool,
}: {
  analytics?: CurriculumAnalytics;
  language: string;
  ownerId: string | null;
  system: string;
  tool: string;
}): Promise<SetupLesson> {
  const identityKey = scopeIdentityKey({
    key: buildSetupSkillIdentityKey({ system, tool }),
    ownerId,
  });

  const existing = await findSetupLesson({ identityKey, language });

  if (existing) {
    return existing;
  }

  const { data, provenance } = await generateSetupLessonOutline({
    analytics,
    language,
    system,
    tool,
  });

  const { skill } = await createSkill({
    description: data.description,
    example: null,
    identityKey,
    language,
    level: SETUP_LEVEL,
    name: data.skill,
    ownerId,
    provenance,
    targetLanguage: null,
  });

  const { lesson } = await createLibraryLesson({
    description: data.description,
    estimatedMinutes: data.estimatedMinutes,
    homeChapterId: null,
    identityKey: scopeIdentityKey({
      key: buildLessonIdentityKey({
        courseId: null,
        level: SETUP_LEVEL,
        skillIds: [skill.id],
        targetLanguage: null,
      }),
      ownerId,
    }),
    language,
    level: SETUP_LEVEL,
    ownerId,
    provenance,
    skillIds: [skill.id],
    targetLanguage: null,
    title: data.title,
  });

  await prisma.lesson.updateMany({
    data: { canDo: data.canDo },
    where: { canDo: null, id: lesson.id },
  });

  return { lessonId: lesson.id, skillId: skill.id, title: lesson.title };
}
