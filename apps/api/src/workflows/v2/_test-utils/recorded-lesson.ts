import { type generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillsFixture } from "@zoonk/testing/fixtures/skills";
import { recordedOutput } from "./recorded-outputs";

const outline =
  recordedOutput<Awaited<ReturnType<typeof generateCourseOutline>>["data"]>("course-outline");

const spec = recordedOutput<Awaited<ReturnType<typeof generateLessonSpec>>["data"]>("lesson-spec");

export async function recordedLessonFixture(attrs?: Parameters<typeof libraryLessonFixture>[0]) {
  const planned = outline.chapters
    .flatMap((chapter) => chapter.lessons)
    .find((lesson) => lesson.title === spec.lessons[0]?.title);

  if (!planned) {
    throw new Error("The recorded lesson must belong to its recorded outline.");
  }

  const lesson = await libraryLessonFixture(attrs);

  const skills = await skillsFixture(planned.skills, {
    language: lesson.language,
    level: lesson.level,
    ownerId: lesson.ownerId,
    visibility: lesson.visibility,
  });

  await prisma.lessonSkill.createMany({
    data: skills.map((skill) => ({ lessonId: lesson.id, skillId: skill.id })),
  });

  return lesson;
}
