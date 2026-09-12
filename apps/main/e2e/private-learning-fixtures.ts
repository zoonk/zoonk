import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";

export const PRIVATE_BRIEF = {
  description: "A private plan for a family project",
  learningGoal: "Make a useful family archive",
  requirements: ["Use our family photographs"],
  startingKnowledge: "I can organize files",
  title: "Our private family archive",
};

export const DISCOVERY_QUESTION = {
  description: "Choose what matters to your family.",
  id: "outcome",
  optional: false,
  options: [{ description: "Share it with relatives", id: "album", label: "A photo album" }],
  question: "What would you like to make?",
};

export async function privateLearningCourse(userId: string) {
  const course = await courseFixture({
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
    format: "personalized",
    isPublished: true,
    title: PRIVATE_BRIEF.title,
    userId,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    title: "Choose a family story",
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    title: "Begin with one memory",
  });

  await stepFixture({
    content: {
      text: "Choose one photograph that reminds you of a shared moment.",
      title: "A shared memory",
      variant: "text",
    },
    isPublished: true,
    lessonId: lesson.id,
  });

  await courseUserFixture({ courseId: course.id, userId });
  const href = `/b/me/c/${course.slug}`;

  return {
    chapter,
    course,
    href,
    lesson,
    lessonHref: `${href}/ch/${chapter.slug}/l/${lesson.slug}`,
  };
}

export function exhaustDiscoveryAllowance(userId: string) {
  const now = new Date();

  return prisma.generationQuotaCounter.create({
    data: {
      actorKey: `user:${userId}`,
      count: 100,
      period: "day",
      periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      resource: "learningRequest",
    },
  });
}
