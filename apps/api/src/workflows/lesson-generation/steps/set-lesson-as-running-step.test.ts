import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { setLessonAsRunningStep } from "./set-lesson-as-running-step";

describe(setLessonAsRunningStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("marks a lesson as running and clears stale steps when requested", async () => {
    const lesson = await createLessonContext({ generationStatus: "failed", organizationId });

    await stepFixture({
      content: { text: "stale", title: "Stale", variant: "text" },
      kind: "static",
      lessonId: lesson.id,
    });

    const result = await setLessonAsRunningStep({
      lessonId: lesson.id,
      resetExistingSteps: true,
      workflowRunId: "workflow-running-1",
    });

    const [updatedLesson, remainingSteps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.step.findMany({ where: { lessonId: lesson.id } }),
    ]);

    expect(result).toBe("claimed");

    expect(updatedLesson).toMatchObject({
      generationRunId: "workflow-running-1",
      generationStatus: "running",
    });

    expect(remainingSteps).toHaveLength(0);

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "started", step: "setLessonAsRunning" }),
        expect.objectContaining({ status: "completed", step: "setLessonAsRunning" }),
      ]),
    );
  });

  it("does not clear steps when another workflow already claimed the lesson", async () => {
    const lesson = await createLessonContext({ generationStatus: "running", organizationId });

    await stepFixture({
      content: { text: "keep", title: "Keep", variant: "text" },
      kind: "static",
      lessonId: lesson.id,
    });

    const result = await setLessonAsRunningStep({
      lessonId: lesson.id,
      resetExistingSteps: true,
      workflowRunId: "workflow-running-2",
    });

    const [updatedLesson, remainingSteps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.step.findMany({ where: { lessonId: lesson.id } }),
    ]);

    expect(result).toBe("skipped");
    expect(updatedLesson.generationRunId).not.toBe("workflow-running-2");
    expect(updatedLesson.generationStatus).toBe("running");
    expect(remainingSteps).toHaveLength(1);
  });
});
