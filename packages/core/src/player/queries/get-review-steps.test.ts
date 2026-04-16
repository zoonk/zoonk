import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepAttemptFixture } from "@zoonk/testing/fixtures/step-attempts";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getReviewSteps, getReviewValidationSteps } from "./get-review-steps";

const REVIEW_TARGET_COUNT = 10;

describe(getReviewSteps, () => {
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let unpublishedStepId: string;

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      language: "en",
      organizationId: org.id,
    });

    // Create a source activity with 12 interactive steps
    const sourceActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    const stepPromises = Array.from({ length: 12 }, (_, i) =>
      stepFixture({
        activityId: sourceActivity.id,
        content: { kind: "core", options: [], question: `Q${i}`, text: `Step ${i}` },
        isPublished: true,
        kind: "multipleChoice",
        position: i,
      }),
    );

    // Also create an unpublished step (should be excluded)
    stepPromises.push(
      stepFixture({
        activityId: sourceActivity.id,
        content: { kind: "core", options: [], question: "Unpub Q", text: "Unpub step" },
        isPublished: false,
        kind: "multipleChoice",
        position: 13,
      }),
    );

    const allSteps = await Promise.all(stepPromises);
    unpublishedStepId = allSteps[12]!.id;
  });

  test("returns steps where user only has incorrect attempts (tier 1)", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // Create incorrect attempts for 3 steps (never corrected = tier 1)
    await Promise.all(
      newLesson.steps.slice(0, 3).map((step) =>
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
      ),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // Should have 10 total (3 mistakes + 7 fillers)
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    // The 3 mistake steps should be included
    const resultIds = result.map((step) => step.id);
    for (const step of newLesson.steps.slice(0, 3)) {
      expect(resultIds).toContain(step.id);
    }
  });

  test("includes steps with incorrect then correct attempts (tier 2) when tier 1 < 10", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // Tier 1: 2 steps with only incorrect attempts
    await Promise.all(
      newLesson.steps.slice(0, 2).map((step) =>
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
      ),
    );

    // Tier 2: 3 steps with incorrect then correct attempts
    await Promise.all(
      newLesson.steps.slice(2, 5).flatMap((step) => [
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: true,
          stepId: step.id,
          userId: newUser.id,
        }),
      ]),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // Should have 10 total (5 mistakes + 5 fillers)
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    // All 5 mistake steps (tier 1 + tier 2) should be included
    const resultIds = result.map((step) => step.id);
    for (const step of newLesson.steps.slice(0, 5)) {
      expect(resultIds).toContain(step.id);
    }
  });

  test("includes all tier 1 and tier 2 steps even when combined count exceeds target", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // Tier 1: 8 steps with only incorrect attempts
    await Promise.all(
      newLesson.steps.slice(0, 8).map((step) =>
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
      ),
    );

    // Tier 2: 4 steps with incorrect then correct attempts
    await Promise.all(
      newLesson.steps.slice(8, 12).flatMap((step) => [
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: true,
          stepId: step.id,
          userId: newUser.id,
        }),
      ]),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    const resultIds = result.map((step) => step.id);

    // All 12 mistake steps should be included (8 tier 1 + 4 tier 2), no fillers
    expect(result).toHaveLength(12);

    for (const step of newLesson.steps) {
      expect(resultIds).toContain(step.id);
    }
  });

  test("when tier 1 >= 10, does NOT include tier 2 or fillers", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // Tier 1: 11 steps with only incorrect attempts
    await Promise.all(
      newLesson.steps.slice(0, 11).map((step) =>
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
      ),
    );

    // Tier 2: 1 step with incorrect then correct
    await Promise.all([
      stepAttemptFixture({
        answer: {},
        dayOfWeek: 1,
        durationSeconds: 10,
        hourOfDay: 12,
        isCorrect: false,
        stepId: newLesson.steps[11]!.id,
        userId: newUser.id,
      }),
      stepAttemptFixture({
        answer: {},
        dayOfWeek: 1,
        durationSeconds: 10,
        hourOfDay: 12,
        isCorrect: true,
        stepId: newLesson.steps[11]!.id,
        userId: newUser.id,
      }),
    ]);

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // Should only have the 11 tier 1 steps, not the tier 2 step
    const resultIds = result.map((step) => step.id);
    expect(resultIds).not.toContain(newLesson.steps[11]!.id);
    expect(result).toHaveLength(11);
  });

  test("deduplicates steps with multiple incorrect attempts", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // Create multiple incorrect attempts for the same step
    await Promise.all([
      stepAttemptFixture({
        answer: {},
        dayOfWeek: 1,
        durationSeconds: 10,
        hourOfDay: 12,
        isCorrect: false,
        stepId: newLesson.steps[0]!.id,
        userId: newUser.id,
      }),
      stepAttemptFixture({
        answer: {},
        dayOfWeek: 2,
        durationSeconds: 10,
        hourOfDay: 12,
        isCorrect: false,
        stepId: newLesson.steps[0]!.id,
        userId: newUser.id,
      }),
    ]);

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // The step should only appear once
    const occurrences = result.filter((step) => step.id === newLesson.steps[0]!.id);
    expect(occurrences).toHaveLength(1);
  });

  /**
   * Each exclusion test uses an isolated lesson with fewer steps than
   * REVIEW_TARGET_COUNT so ALL eligible steps are returned. This makes
   * the assertion deterministic: if the filter is broken, the excluded
   * step will always appear in the result.
   */

  test("excludes review activity steps", async () => {
    const isolated = await createLessonWithSteps(org.id, 3);

    const reviewActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "review",
      language: "en",
      lessonId: isolated.lesson.id,
      organizationId: org.id,
    });

    const reviewStep = await stepFixture({
      activityId: reviewActivity.id,
      content: { kind: "core", options: [], question: "Review Q" },
      isPublished: true,
      kind: "multipleChoice",
      position: 0,
    });

    const result = await getReviewSteps({
      lessonId: isolated.lesson.id,
      userId: null,
    });

    expect(result).toHaveLength(3);

    const resultIds = result.map((step) => step.id);
    expect(resultIds).not.toContain(reviewStep.id);
  });

  test("excludes static steps", async () => {
    const isolated = await createLessonWithSteps(org.id, 3);

    await stepFixture({
      activityId: isolated.activity.id,
      content: { text: "Static content", title: "Static" },
      isPublished: true,
      kind: "static",
      position: 10,
    });

    const result = await getReviewSteps({
      lessonId: isolated.lesson.id,
      userId: null,
    });

    expect(result).toHaveLength(3);

    for (const step of result) {
      expect(step.kind).not.toBe("static");
    }
  });

  test("excludes story steps", async () => {
    const isolated = await createLessonWithSteps(org.id, 3);

    const storyActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "story",
      language: "en",
      lessonId: isolated.lesson.id,
      organizationId: org.id,
    });

    await stepFixture({
      activityId: storyActivity.id,
      content: {
        choices: [
          {
            alignment: "strong",
            consequence: "Good outcome",
            id: "c1",
            metricEffects: [{ effect: "positive", metric: "Score" }],
            text: "Choice A",
          },
        ],
        situation: "A scenario",
      },
      isPublished: true,
      kind: "story",
      position: 0,
    });

    const result = await getReviewSteps({
      lessonId: isolated.lesson.id,
      userId: null,
    });

    expect(result).toHaveLength(3);

    for (const step of result) {
      expect(step.kind).not.toBe("story");
    }
  });

  test("excludes investigation steps", async () => {
    const isolated = await createLessonWithSteps(org.id, 3);

    const investigationActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "investigation",
      language: "en",
      lessonId: isolated.lesson.id,
      organizationId: org.id,
    });

    await stepFixture({
      activityId: investigationActivity.id,
      content: {
        explanations: [{ accuracy: "best", text: "Explanation A" }],
        scenario: "A mystery scenario",
        variant: "problem",
        visual: { kind: "image", url: "https://example.com/img.jpg" },
      },
      isPublished: true,
      kind: "investigation",
      position: 0,
    });

    const result = await getReviewSteps({
      lessonId: isolated.lesson.id,
      userId: null,
    });

    expect(result).toHaveLength(3);

    for (const step of result) {
      expect(step.kind).not.toBe("investigation");
    }
  });

  test("fills with random steps when total mistakes < 10", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // Only 2 mistakes
    await Promise.all(
      newLesson.steps.slice(0, 2).map((step) =>
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
      ),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // Should have exactly REVIEW_TARGET_COUNT (10) unique steps
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    const resultIds = result.map((step) => step.id);
    expect(new Set(resultIds).size).toBe(REVIEW_TARGET_COUNT);

    // The 2 mistake steps should be included
    for (const step of newLesson.steps.slice(0, 2)) {
      expect(resultIds).toContain(step.id);
    }
  });

  test("returns random steps for unauthenticated user (userId null)", async () => {
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: null,
    });

    // Shared lesson has 12 interactive steps, so result should be exactly 10
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    for (const step of result) {
      expect(step.kind).not.toBe("static");
    }
  });

  test("returns random steps for user with no attempts", async () => {
    const newUser = await userFixture();

    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: newUser.id,
    });

    // No attempts means all steps are fillers, capped at REVIEW_TARGET_COUNT
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    for (const step of result) {
      expect(step.kind).not.toBe("static");
    }
  });

  test("handles lesson with fewer than 10 interactive steps", async () => {
    const newLesson = await createLessonWithSteps(org.id, 5);

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: null,
    });

    // Should return all 5 available steps (less than target)
    expect(result).toHaveLength(5);
  });

  test("returns empty array when lesson has no eligible interactive steps", async () => {
    const newLesson = await createLessonWithSteps(org.id, 0);

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: null,
    });

    expect(result).toHaveLength(0);
  });

  test("excludes unpublished steps", async () => {
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: null,
    });

    const resultIds = result.map((step) => step.id);
    expect(resultIds).not.toContain(unpublishedStepId);
  });

  test("when tier 1 is exactly 10, excludes tier 2", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // Tier 1: exactly 10 steps with only incorrect attempts
    await Promise.all(
      newLesson.steps.slice(0, 10).map((step) =>
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
      ),
    );

    // Tier 2: 2 steps with incorrect then correct
    await Promise.all(
      newLesson.steps.slice(10, 12).flatMap((step) => [
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: true,
          stepId: step.id,
          userId: newUser.id,
        }),
      ]),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // Exactly 10 tier 1 hits the >= threshold, so tier 2 should be excluded
    expect(result).toHaveLength(10);

    const resultIds = result.map((step) => step.id);

    for (const step of newLesson.steps.slice(0, 10)) {
      expect(resultIds).toContain(step.id);
    }

    for (const step of newLesson.steps.slice(10, 12)) {
      expect(resultIds).not.toContain(step.id);
    }
  });

  test("steps with only correct attempts are not prioritized", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // 1 tier 1 step (incorrect only)
    await stepAttemptFixture({
      answer: {},
      dayOfWeek: 1,
      durationSeconds: 10,
      hourOfDay: 12,
      isCorrect: false,
      stepId: newLesson.steps[0]!.id,
      userId: newUser.id,
    });

    // 1 step with only correct attempts (should NOT be tier 1 or tier 2)
    await stepAttemptFixture({
      answer: {},
      dayOfWeek: 1,
      durationSeconds: 10,
      hourOfDay: 12,
      isCorrect: true,
      stepId: newLesson.steps[1]!.id,
      userId: newUser.id,
    });

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // Should have 10 steps (1 prioritized + 9 fillers)
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    // The correct-only step may appear as a filler but should not be guaranteed;
    // the tier 1 step must always be present
    const resultIds = result.map((step) => step.id);
    expect(resultIds).toContain(newLesson.steps[0]!.id);
  });

  test("does not return duplicate steps when mixing prioritized and fillers", async () => {
    const newLesson = await createLessonWithSteps(org.id, 12);
    const newUser = await userFixture();

    // 5 tier 1 steps
    await Promise.all(
      newLesson.steps.slice(0, 5).map((step) =>
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: false,
          stepId: step.id,
          userId: newUser.id,
        }),
      ),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    // 5 prioritized + 5 fillers = 10, all unique
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    const resultIds = result.map((step) => step.id);
    expect(new Set(resultIds).size).toBe(REVIEW_TARGET_COUNT);
  });

  test("excludes steps from archived activities", async () => {
    const newLesson = await createLessonWithSteps(org.id, 2);
    const newUser = await userFixture();

    await stepAttemptFixture({
      answer: {},
      dayOfWeek: 1,
      durationSeconds: 10,
      hourOfDay: 12,
      isCorrect: false,
      stepId: newLesson.steps[0]!.id,
      userId: newUser.id,
    });

    await prisma.activity.update({
      data: { archivedAt: new Date() },
      where: { id: newLesson.activity.id },
    });

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: newUser.id,
    });

    expect(result).toEqual([]);
  });
});

describe(getReviewValidationSteps, () => {
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let organizationId: string;
  let quizStep: Awaited<ReturnType<typeof stepFixture>>;
  let reviewStep: Awaited<ReturnType<typeof stepFixture>>;
  let staticStep: Awaited<ReturnType<typeof stepFixture>>;

  beforeAll(async () => {
    const org = await organizationFixture();
    organizationId = org.id;
    const course = await courseFixture({ isPublished: true, organizationId: org.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });
    lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    const mcContent = {
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: "A" },
        { feedback: "Wrong.", isCorrect: false, text: "B" },
      ],
    };

    const [quizActivity, reviewActivity] = await Promise.all([
      activityFixture({
        isPublished: true,
        kind: "quiz",
        lessonId: lesson.id,
        organizationId: org.id,
      }),
      activityFixture({
        isPublished: true,
        kind: "review",
        lessonId: lesson.id,
        organizationId: org.id,
      }),
    ]);

    [quizStep, reviewStep, staticStep] = await Promise.all([
      stepFixture({
        activityId: quizActivity.id,
        content: mcContent,
        isPublished: true,
        kind: "multipleChoice",
      }),
      stepFixture({
        activityId: reviewActivity.id,
        content: mcContent,
        isPublished: true,
        kind: "multipleChoice",
      }),
      stepFixture({
        activityId: quizActivity.id,
        content: mcContent,
        isPublished: true,
        kind: "static",
      }),
    ]);
  });

  test("excludes steps from review activities", async () => {
    const steps = await getReviewValidationSteps({
      lessonId: lesson.id,
      stepIds: [quizStep.id, reviewStep.id],
    });

    const stepIds = steps.map((step) => step.id);

    expect(stepIds).toContain(quizStep.id);
    expect(stepIds).not.toContain(reviewStep.id);
  });

  test("excludes static steps", async () => {
    const steps = await getReviewValidationSteps({
      lessonId: lesson.id,
      stepIds: [quizStep.id, staticStep.id],
    });

    const stepIds = steps.map((step) => step.id);

    expect(stepIds).toContain(quizStep.id);
    expect(stepIds).not.toContain(staticStep.id);
  });

  test("includes canonical sentence metadata for review validation", async () => {
    const sentence = await sentenceFixture({ organizationId });

    await lessonSentenceFixture({
      distractors: ["Morgen"],
      lessonId: lesson.id,
      sentenceId: sentence.id,
      translation: "Hello, I am Lara.",
      translationDistractors: ["Good"],
      userLanguage: "en",
    });

    const readingActivity = await activityFixture({
      isPublished: true,
      kind: "reading",
      lessonId: lesson.id,
      organizationId,
    });

    const readingStep = await stepFixture({
      activityId: readingActivity.id,
      content: {},
      isPublished: true,
      kind: "reading",
      sentenceId: sentence.id,
    });

    const steps = await getReviewValidationSteps({
      lessonId: lesson.id,
      stepIds: [readingStep.id],
    });

    expect(steps[0]?.sentence).toMatchObject({
      sentence: sentence.sentence,
    });
  });

  test("excludes steps from archived activities during validation", async () => {
    await prisma.activity.update({
      data: { archivedAt: new Date() },
      where: { id: quizStep.activityId },
    });

    const steps = await getReviewValidationSteps({
      lessonId: lesson.id,
      stepIds: [quizStep.id],
    });

    expect(steps).toEqual([]);
  });
});

/**
 * Helper to create an isolated lesson with a given number of interactive steps.
 */
async function createLessonWithSteps(orgId: string, stepCount: number) {
  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: orgId,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language: "en",
    organizationId: orgId,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    language: "en",
    organizationId: orgId,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    language: "en",
    lessonId: lesson.id,
    organizationId: orgId,
    position: 0,
  });

  const steps = await Promise.all(
    Array.from({ length: stepCount }, (_, i) =>
      stepFixture({
        activityId: activity.id,
        content: { kind: "core", options: [], question: `Q${i}`, text: `Step ${i}` },
        isPublished: true,
        kind: "multipleChoice",
        position: i,
      }),
    ),
  );

  return { activity, lesson, steps };
}
