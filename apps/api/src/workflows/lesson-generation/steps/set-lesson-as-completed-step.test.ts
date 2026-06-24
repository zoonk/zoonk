import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { setLessonAsCompletedStep } from "./set-lesson-as-completed-step";

describe(setLessonAsCompletedStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("marks a lesson as completed", async () => {
    const context = await createLessonContext({ generationStatus: "running", organizationId });

    await setLessonAsCompletedStep({ context });

    const updatedLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: context.id } });

    expect(updatedLesson.generationStatus).toBe("completed");

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "completed", step: "setLessonAsCompleted" }),
      ]),
    );
  });

  it("saves generated lesson metadata with the completion status", async () => {
    const context = await createLessonContext({ generationStatus: "running", organizationId });

    await setLessonAsCompletedStep({
      context,
      description: "Generated practice scenario",
      imageUrl: "https://example.com/lesson-complete.webp",
      title: "Generated Practice",
    });

    const updatedLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: context.id } });

    expect(updatedLesson.description).toBe("Generated practice scenario");
    expect(updatedLesson.generationStatus).toBe("completed");
    expect(updatedLesson.imageUrl).toBe("https://example.com/lesson-complete.webp");
    expect(updatedLesson.title).toBe("Generated Practice");
  });
});
