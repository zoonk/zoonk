import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepAttemptFixture } from "@zoonk/testing/fixtures/step-attempts";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getReviewSteps, getReviewValidationSteps } from "./get-review-steps";

const REVIEW_TARGET_COUNT = 10;

describe(getReviewSteps, () => {
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let user: Awaited<ReturnType<typeof userFixture>>;

  let challengeStepId: bigint;
  let reviewStepId: bigint;
  let unpublishedStepId: bigint;

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

    const reviewStep = await stepFixture({
      activityId: reviewActivity.id,
      content: { kind: "core", options: [], question: "Review Q", text: "Review step" },
      isPublished: true,
      kind: "multipleChoice",
      position: 0,
    });

    reviewStepId = reviewStep.id;

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

    const challengeStep = await stepFixture({
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

    challengeStepId = challengeStep.id;

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
    unpublishedStepId = allSteps[13]!.id;
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

    const resultIds = result.map((step) => step.id);
    expect(resultIds).not.toContain(reviewStepId);
  });

  test("excludes challenge activity steps", async () => {
    const result = await getReviewSteps({
      lessonId: lesson.id,
      userId: Number(user.id),
    });

    const resultIds = result.map((step) => step.id);
    expect(resultIds).not.toContain(challengeStepId);
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
      userId: Number(newUser.id),
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
          userId: Number(newUser.id),
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
      userId: Number(newUser.id),
    });

    // 1 step with only correct attempts (should NOT be tier 1 or tier 2)
    await stepAttemptFixture({
      answer: {},
      dayOfWeek: 1,
      durationSeconds: 10,
      hourOfDay: 12,
      isCorrect: true,
      stepId: newLesson.steps[1]!.id,
      userId: Number(newUser.id),
    });

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
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
          userId: Number(newUser.id),
        }),
      ),
    );

    const result = await getReviewSteps({
      lessonId: newLesson.lesson.id,
      userId: Number(newUser.id),
    });

    // 5 prioritized + 5 fillers = 10, all unique
    expect(result).toHaveLength(REVIEW_TARGET_COUNT);

    const resultIds = result.map((step) => step.id);
    expect(new Set(resultIds).size).toBe(REVIEW_TARGET_COUNT);
  });
});

describe(getReviewValidationSteps, () => {
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let quizStep: Awaited<ReturnType<typeof stepFixture>>;
  let challengeStep: Awaited<ReturnType<typeof stepFixture>>;
  let reviewStep: Awaited<ReturnType<typeof stepFixture>>;
  let staticStep: Awaited<ReturnType<typeof stepFixture>>;

  beforeAll(async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const chapter = await chapterFixture({ courseId: course.id, organizationId: org.id });
    lesson = await lessonFixture({ chapterId: chapter.id, organizationId: org.id });

    const mcContent = {
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: "A" },
        { feedback: "Wrong.", isCorrect: false, text: "B" },
      ],
    };

    const [quizActivity, challengeActivity, reviewActivity] = await Promise.all([
      activityFixture({ kind: "quiz", lessonId: lesson.id, organizationId: org.id }),
      activityFixture({ kind: "challenge", lessonId: lesson.id, organizationId: org.id }),
      activityFixture({ kind: "review", lessonId: lesson.id, organizationId: org.id }),
    ]);

    [quizStep, challengeStep, reviewStep, staticStep] = await Promise.all([
      stepFixture({
        activityId: quizActivity.id,
        content: mcContent,
        isPublished: true,
        kind: "multipleChoice",
      }),
      stepFixture({
        activityId: challengeActivity.id,
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

  test("excludes steps from challenge and review activities", async () => {
    const steps = await getReviewValidationSteps(lesson.id, [
      quizStep.id,
      challengeStep.id,
      reviewStep.id,
    ]);

    const stepIds = steps.map((step) => step.id);

    expect(stepIds).toContain(quizStep.id);
    expect(stepIds).not.toContain(challengeStep.id);
    expect(stepIds).not.toContain(reviewStep.id);
  });

  test("excludes static steps", async () => {
    const steps = await getReviewValidationSteps(lesson.id, [quizStep.id, staticStep.id]);

    const stepIds = steps.map((step) => step.id);

    expect(stepIds).toContain(quizStep.id);
    expect(stepIds).not.toContain(staticStep.id);
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
