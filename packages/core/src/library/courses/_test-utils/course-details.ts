import { getCourseDetailsPromptVersion } from "@zoonk/ai/tasks/v2/courses/details";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";

export const details = {
  categories: ["health" as const, "science" as const],
  description: "Immunology is how the body tells friend from foe.",
  landingPage: {
    audience: ["Parents deciding on vaccines"],
    outcomes: ["Explain how a vaccine trains memory cells"],
    valueProposition: "Make sense of vaccine news.",
  },
};

export const provenance = {
  generatedAt: "2026-09-27T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: getCourseDetailsPromptVersion(),
  runId: "details-run-1",
};

export async function outlinedCourse(attrs?: Parameters<typeof courseFixture>[0]) {
  const course = await courseFixture({ title: "Immunology", ...attrs });

  const [chapter] = await Promise.all([
    libraryChapterFixture({ description: "How antibodies find germs", title: "Antibodies" }),
    attrs?.description
      ? null
      : prisma.course.update({ data: { description: null }, where: { id: course.id } }),
  ]);

  await courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "overview" });

  return course;
}
