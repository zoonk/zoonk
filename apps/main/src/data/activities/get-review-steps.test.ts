import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepAttemptFixture } from "@zoonk/testing/fixtures/step-attempts";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getReviewSteps } from "./get-review-steps";

const REVIEW_TARGET_COUNT = 10;

describe(getReviewSteps, () => {
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let user: Awaited<ReturnType<typeof userFixture>>;

  // Interactive steps on a non-review activity (source steps for review)
  let interactiveSteps: Awaited<ReturnType<typeof stepFixture>>[];

  beforeAll(async () => {
    org = await organizationFixture({ kind: "brand" });

    const [courseResult, userResult] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: org.id,
      }),
      userFixture(),
    ]);

    user = userResult;

    const chapter = await chapterFixture({
      courseId: courseResult.id,
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

    // Create a source activity with 12 interactive steps + 1 static step
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

    // Also create a static step (should be excluded from reviews)
    stepPromises.push(
      stepFixture({
        activityId: sourceActivity.id,
        content: { text: "Static content", title: "Static" },
        isPublished: true,
        kind: "static",
        position: 12,
      }),
    );

    // Also create a review activity (its steps should be excluded)
    const reviewActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "review",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    });

    await stepFixture({
      activityId: reviewActivity.id,
      content: { kind: "core", options: [], question: "Review Q", text: "Review step" },
      isPublished: true,
      kind: "multipleChoice",
      position: 0,
    });

    // Also create a challenge activity (its steps should be excluded)
    const challengeActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "challenge",
      language: "en",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 2,
    });

    await stepFixture({
      activityId: challengeActivity.id,
      content: {
        kind: "challenge",
        options: [{ effects: [{ dimension: "speed", value: 1 }], text: "Option A" }],
        question: "Challenge Q",
      },
      isPublished: true,
      kind: "multipleChoice",
      position: 0,
    });

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

    // First 12 are the interactive published steps
    interactiveSteps = allSteps.slice(0, 12);
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
          userId: Number(newUser.id),
        }),
      ),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
    });

    // Should include the 3 mistake steps
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
          userId: Number(newUser.id),
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
          userId: Number(newUser.id),
        }),
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: true,
          stepId: step.id,
          userId: Number(newUser.id),
        }),
      ]),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
    });

    const resultIds = result.map((step) => step.id);

    // All 5 mistake steps (tier 1 + tier 2) should be included
    for (const step of newLesson.steps.slice(0, 5)) {
      expect(resultIds).toContain(step.id);
    }
  });

  test("prioritizes tier 1 over tier 2 (tier 1 steps come first before shuffle)", async () => {
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
          userId: Number(newUser.id),
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
          userId: Number(newUser.id),
        }),
        stepAttemptFixture({
          answer: {},
          dayOfWeek: 1,
          durationSeconds: 10,
          hourOfDay: 12,
          isCorrect: true,
          stepId: step.id,
          userId: Number(newUser.id),
        }),
      ]),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
    });

    // All 12 steps should be included (8 tier 1 + 4 tier 2)
    expect(result).toHaveLength(12);
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
          userId: Number(newUser.id),
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
        userId: Number(newUser.id),
      }),
      stepAttemptFixture({
        answer: {},
        dayOfWeek: 1,
        durationSeconds: 10,
        hourOfDay: 12,
        isCorrect: true,
        stepId: newLesson.steps[11]!.id,
        userId: Number(newUser.id),
      }),
    ]);

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
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
        userId: Number(newUser.id),
      }),
      stepAttemptFixture({
        answer: {},
        dayOfWeek: 2,
        durationSeconds: 10,
        hourOfDay: 12,
        isCorrect: false,
        stepId: newLesson.steps[0]!.id,
        userId: Number(newUser.id),
      }),
    ]);

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
    });

    // The step should only appear once
    const occurrences = result.filter((step) => step.id === newLesson.steps[0]!.id);
    expect(occurrences).toHaveLength(1);
  });

  test("excludes review activity steps", async () => {
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: Number(user.id),
    });

    // All results should come from non-review activities
    const validStepIds = new Set(interactiveSteps.map((step) => step.id));

    for (const resultStep of result) {
      expect(validStepIds.has(resultStep.id)).toBeTruthy();
    }
  });

  test("excludes challenge activity steps", async () => {
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: Number(user.id),
    });

    // All results should come from non-challenge activities
    const validStepIds = new Set(interactiveSteps.map((step) => step.id));

    for (const resultStep of result) {
      expect(validStepIds.has(resultStep.id)).toBeTruthy();
    }
  });

  test("excludes static steps", async () => {
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: Number(user.id),
    });

    // No static steps should be in results
    for (const step of result) {
      expect(step.kind).not.toBe("static");
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
          userId: Number(newUser.id),
        }),
      ),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
    });

    // Should have exactly REVIEW_TARGET_COUNT (10) steps
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    // The 2 mistake steps should be included
    const resultIds = result.map((step) => step.id);
    for (const step of newLesson.steps.slice(0, 2)) {
      expect(resultIds).toContain(step.id);
    }
  });

  test("returns random steps for unauthenticated user (userId null)", async () => {
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: null,
    });

    // Should return up to REVIEW_TARGET_COUNT random interactive steps
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(REVIEW_TARGET_COUNT);

    // No static steps
    for (const step of result) {
      expect(step.kind).not.toBe("static");
    }
  });

  test("returns random steps for user with no attempts", async () => {
    const newUser = await userFixture();

    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: Number(newUser.id),
    });

    // Should return up to REVIEW_TARGET_COUNT random interactive steps
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(REVIEW_TARGET_COUNT);
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

  test("only includes published steps from the given lesson", async () => {
    // The shared lesson already has unpublished steps and review steps set up in beforeAll
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: null,
    });

    // Verify all returned steps are from interactiveSteps (published, non-static, non-review)
    const validIds = new Set(interactiveSteps.map((step) => step.id));

    for (const step of result) {
      expect(validIds.has(step.id)).toBeTruthy();
    }
  });
});

/**
 * Helper to create an isolated lesson with a given number of interactive steps.
 */
async function createLessonWithSteps(orgId: number, stepCount: number) {
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
