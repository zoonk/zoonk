import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { setLessonAsCompletedStep } from "./set-lesson-as-completed-step";

describe(setLessonAsCompletedStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  test("marks a lesson as completed", async () => {
    const context = await createLessonContext({ generationStatus: "running", organizationId });

    await setLessonAsCompletedStep({ context });

    const updatedLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: context.id } });

    expect(updatedLesson.generationStatus).toBe("completed");
    expect(getStreamedEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "completed", step: "setLessonAsCompleted" }),
      ]),
    );
  });
});
