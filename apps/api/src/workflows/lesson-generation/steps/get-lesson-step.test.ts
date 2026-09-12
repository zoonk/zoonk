import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { getLessonStep } from "./get-lesson-step";

describe(getLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("loads a persisted owner-private lesson for its authorized background workflow", async () => {
    const user = await userFixture();

    const course = await courseFixture({
      format: "personalized",
      organizationId: null,
      userId: user.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId: null });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId: null });
    const result = await getLessonStep(lesson.id);
    expect(result.chapter.course.userId).toBe(user.id);
    expect(result.chapter.course.organization).toBeNull();
  });

  it("loads lessons with the nested course context needed by generation", async () => {
    const lesson = await createLessonContext({ organizationId });

    const context = await getLessonStep(lesson.id);

    expect(context.id).toBe(lesson.id);
    expect(context.chapter.course.organization?.id).toBe(organizationId);

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "started", step: "getLesson" }),
        expect.objectContaining({ status: "completed", step: "getLesson" }),
      ]),
    );
  });

  it("throws for lessons outside the AI organization", async () => {
    const otherOrg = await organizationFixture();
    const lesson = await createLessonContext({ organizationId: otherOrg.id });

    await expect(getLessonStep(lesson.id)).rejects.toThrow("Lesson not found");

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "notFound", status: "error", step: "getLesson" }),
      ]),
    );
  });
});
