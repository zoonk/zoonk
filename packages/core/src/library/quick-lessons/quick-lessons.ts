import "server-only";
import { type CourseLevel, type LibraryVisibility, prisma } from "@zoonk/db";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { QUICK_LESSON_MINUTES, getQuickLessonIdentityKey } from "./quick-lesson-identity";

export type QuickLessonRef = { estimatedMinutes: number; lessonId: string; title: string };

const QUICK_LESSON_TITLES: Readonly<Record<string, string>> = {
  de: "Kurzlektion: {skill}",
  en: "Quick lesson: {skill}",
  es: "Clase rápida: {skill}",
  fr: "Leçon rapide : {skill}",
  pt: "Aula rápida: {skill}",
};

type HomeCandidate = {
  id: string;
  level: CourseLevel;
  ownerId: string | null;
  visibility: LibraryVisibility;
};

async function loadSkills(skillIds: readonly string[]) {
  return prisma.skill.findMany({
    select: {
      chapters: {
        orderBy: { createdAt: "asc" },
        select: { chapter: { select: { id: true, level: true, ownerId: true, visibility: true } } },
      },
      description: true,
      id: true,
      language: true,
      level: true,
      name: true,
      ownerId: true,
      targetLanguage: true,
      visibility: true,
    },
    where: { id: { in: [...new Set(skillIds)] } },
  });
}

type QuickLessonSkill = Awaited<ReturnType<typeof loadSkills>>[number];

function pickHomeChapter({
  chapters,
  ownerId,
}: {
  chapters: readonly HomeCandidate[];
  ownerId: string | null;
}): HomeCandidate | null {
  return (
    chapters.find((chapter) =>
      ownerId
        ? chapter.visibility === "private" && chapter.ownerId === ownerId
        : chapter.visibility === "public",
    ) ?? null
  );
}

function getQuickLessonTitle({ language, name }: Pick<QuickLessonSkill, "language" | "name">) {
  const template = QUICK_LESSON_TITLES[language] ?? QUICK_LESSON_TITLES.en ?? "{skill}";
  return template.replace("{skill}", name);
}

function getQuickLessonOwner(skill: Pick<QuickLessonSkill, "ownerId" | "visibility">) {
  return skill.visibility === "private" ? skill.ownerId : null;
}

function toQuickLessonRef(lesson: {
  estimatedMinutes: number;
  id: string;
  setAsideAt: Date | null;
  title: string;
}): QuickLessonRef | null {
  return lesson.setAsideAt
    ? null
    : { estimatedMinutes: lesson.estimatedMinutes, lessonId: lesson.id, title: lesson.title };
}

async function ensureQuickLesson(skill: QuickLessonSkill): Promise<QuickLessonRef | null> {
  const ownerId = getQuickLessonOwner(skill);

  const home = pickHomeChapter({ chapters: skill.chapters.map((entry) => entry.chapter), ownerId });

  const { lesson } = await createLibraryLesson({
    canDo: skill.name,
    description: skill.description,
    estimatedMinutes: QUICK_LESSON_MINUTES,
    homeChapterId: home?.id ?? null,
    identityKey: getQuickLessonIdentityKey({ ownerId, skillId: skill.id }),
    language: skill.language,
    level: skill.level ?? home?.level ?? "beginner",
    ownerId,
    provenance: {
      generatedAt: new Date(),
      model: "pending",
      promptVersion: "pending",
      runId: "pending",
    },
    skillIds: [skill.id],
    targetLanguage: skill.targetLanguage,
    title: getQuickLessonTitle(skill),
  });

  return toQuickLessonRef(lesson);
}

function toRefMap(entries: readonly (readonly [string, QuickLessonRef | null])[]) {
  return new Map(entries.flatMap(([skillId, ref]) => (ref ? [[skillId, ref] as const] : [])));
}

/** Internal: authorize the plan's skills first; use `findQuickLessons` where creating rows is forbidden. */
export async function ensureQuickLessons({
  skillIds,
}: {
  skillIds: readonly string[];
}): Promise<Map<string, QuickLessonRef>> {
  const skills = await loadSkills(skillIds);

  const entries = await Promise.all(
    skills.map(async (skill) => [skill.id, await ensureQuickLesson(skill)] as const),
  );

  return toRefMap(entries);
}

/** Internal: authorize the plan's skills first; creates no rows, unlike `ensureQuickLessons`. */
export async function findQuickLessons({
  skillIds,
}: {
  skillIds: readonly string[];
}): Promise<Map<string, QuickLessonRef>> {
  const skills = await prisma.skill.findMany({
    select: { id: true, language: true, ownerId: true, visibility: true },
    where: { id: { in: [...new Set(skillIds)] } },
  });

  const keys = skills.map((skill) => ({
    identityKey: getQuickLessonIdentityKey({
      ownerId: getQuickLessonOwner(skill),
      skillId: skill.id,
    }),
    skill,
  }));

  const lessons = await prisma.lesson.findMany({
    select: {
      estimatedMinutes: true,
      id: true,
      identityKey: true,
      language: true,
      setAsideAt: true,
      title: true,
    },
    where: { identityKey: { in: keys.map((entry) => entry.identityKey) } },
  });

  return toRefMap(
    keys.map(({ identityKey, skill }) => {
      const lesson = lessons.find(
        (candidate) =>
          candidate.identityKey === identityKey && candidate.language === skill.language,
      );

      return [skill.id, lesson ? toQuickLessonRef(lesson) : null] as const;
    }),
  );
}
