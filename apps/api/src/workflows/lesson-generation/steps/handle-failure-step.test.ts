import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { handleLessonFailureStep } from "./handle-failure-step";

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

describe(handleLessonFailureStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("marks a lesson as failed after workflow failure", async () => {
    const lesson = await createLessonContext({ generationStatus: "running", organizationId });

    await handleLessonFailureStep({
      error: { message: "AI failed", name: "Error", stack: "stack" },
      lessonId: lesson.id,
    });

    const updatedLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(updatedLesson.generationStatus).toBe("failed");

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "aiGenerationFailed",
          status: "error",
          step: "workflowError",
        }),
      ]),
    );
  });
});
