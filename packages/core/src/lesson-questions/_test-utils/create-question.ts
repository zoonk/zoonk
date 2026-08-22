import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../_test-utils/mock-session";
import { createLessonQuestion } from "../create-lesson-question";

export async function createLessonQuestionFixture({
  chapterPosition = 0,
}: { chapterPosition?: number } = {}) {
  const [organization, user] = await Promise.all([
    organizationFixture({ kind: "brand" }),
    userFixture(),
  ]);

  const course = await courseFixture({ isPublished: true, organizationId: organization.id });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
    position: chapterPosition,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: organization.id,
  });

  mockSession(user.id);

  if (chapterPosition > 0) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  const created = await createLessonQuestion({
    input: {
      context: { kind: "lesson" },
      question: "How does this connect?",
      requestId: randomUUID(),
    },
    lessonId: lesson.id,
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  return { chapter, lesson, organization, question: created.question, user };
}
