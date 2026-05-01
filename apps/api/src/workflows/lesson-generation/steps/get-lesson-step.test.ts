import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { getLessonStep } from "./get-lesson-step";

describe(getLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
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
