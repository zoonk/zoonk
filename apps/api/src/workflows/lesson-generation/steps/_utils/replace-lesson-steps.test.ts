import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepAttemptFixture } from "@zoonk/testing/fixtures/step-attempts";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { createLessonContext } from "../_test-utils/create-lesson-context";
import { replaceLessonSteps } from "./replace-lesson-steps";

describe(replaceLessonSteps, () => {
  it("preserves completed lesson steps and their attempts", async () => {
    const organization = await aiOrganizationFixture();

    const [context, user] = await Promise.all([
      createLessonContext({ generationStatus: "completed", organizationId: organization.id }),
      userFixture(),
    ]);

    const existingStep = await stepFixture({
      content: { text: "Completed content", title: "Completed step", variant: "text" },
      isPublished: true,
      kind: "static",
      lessonId: context.id,
      position: 0,
    });

    const attempt = await stepAttemptFixture({
      answer: {},
      dayOfWeek: 1,
      durationSeconds: 5,
      hourOfDay: 12,
      isCorrect: true,
      stepId: existingStep.id,
      userId: user.id,
    });

    await replaceLessonSteps({
      lessonId: context.id,
      saveSteps: async (transaction) => {
        await transaction.step.create({
          data: {
            content: { text: "Stale replacement", title: "Stale step", variant: "text" },
            isPublished: true,
            kind: "static",
            lessonId: context.id,
            position: 0,
          },
        });
      },
    });

    const [savedStep, savedAttempt] = await Promise.all([
      prisma.step.findUnique({ where: { id: existingStep.id } }),
      prisma.stepAttempt.findUnique({ where: { id: attempt.id } }),
    ]);

    expect(savedStep?.id).toBe(existingStep.id);
    expect(savedAttempt?.stepId).toBe(existingStep.id);
  });
});
