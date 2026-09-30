import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getEstimatedCostMicros } from "../../entitlements/limits";
import { createGoals } from "../../goals/create-goals";
import { recordGoalGeneration } from "../../goals/record-goal-generation";
import { getExplanation } from "./get-explanation";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

async function explainGoalFixture({
  courseId = null,
  userId,
}: {
  courseId?: string | null;
  userId: string;
}) {
  return goalFixture({
    details: {
      question: "how does a microwave work?",
      relatedQuestions: ["How does Wi-Fi work?", ""],
    },
    kind: "explain",
    primaryCourseId: courseId,
    prompt: "how does a microwave work?",
    title: "How a microwave works",
    userId,
  });
}

describe(getExplanation, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("says the explanation is being written until its lesson is ready", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const goal = await explainGoalFixture({ userId: user.id });
    await planFixture({ goalId: goal.id });
    await recordGoalGeneration({ generationId: "run-writing-it", goalId: goal.id });

    const result = await getExplanation({ goalId: goal.id });

    expect(result).toStrictEqual({
      explanation: {
        generationId: "run-writing-it",
        goFurther: { course: null, questions: ["How does Wi-Fi work?"] },
        goalId: goal.id,
        lesson: null,
        outline: [],
        question: "how does a microwave work?",
        recap: [],
        status: "preparing",
        title: "How a microwave works",
      },
      status: "ready",
    });
  });

  it("plays the story and its check, and keeps the summary for the recap", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const organization = await organizationFixture();

    const course = await courseFixture({
      description: "The physics behind everyday things",
      organizationId: organization.id,
      title: "Everyday physics",
      visibility: "public",
    });

    const [goal, played] = await Promise.all([
      explainGoalFixture({ courseId: course.id, userId: user.id }),
      playableLessonFixture({ steps: ["explanation", "explanation", "check", "summary"] }),
    ]);

    const plan = await planFixture({ goalId: goal.id });

    await planItemFixture({
      kind: "lesson",
      lessonId: played.lesson.id,
      planId: plan.id,
      titleSnapshot: "x",
    });

    const result = await getExplanation({ goalId: goal.id });
    const explanation = result.status === "ready" ? result.explanation : null;

    expect(explanation?.status).toBe("ready");

    expect(explanation?.lesson?.steps.map((step) => step.kind)).toStrictEqual([
      "explanation",
      "explanation",
      "check",
    ]);

    expect(explanation?.recap).toHaveLength(3);

    expect(explanation?.outline).toStrictEqual([
      "A cloud, not a little ball",
      "A cloud, not a little ball",
    ]);

    expect(explanation?.goFurther.course).toStrictEqual({
      brandSlug: organization.slug,
      chapterCount: 0,
      courseSlug: course.slug,
      description: "The physics behind everyday things",
      id: course.id,
      title: "Everyday physics",
    });
  });

  it("only opens the learner's own quick explanations", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const [explain, learn] = await Promise.all([
      explainGoalFixture({ userId: owner.id }),
      goalFixture({ userId: owner.id }),
    ]);

    mockSession(owner.id);

    await expect(getExplanation({ goalId: learn.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(other.id);

    await expect(getExplanation({ goalId: explain.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(getExplanation({ goalId: explain.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});

describe("asking a quick question", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("uses the explanations allowance and leaves the goal the learner follows active", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const followed = await createGoals({
      dailyMinutes: 15,
      goals: [{ kind: "learn", language: "en", prompt: "physics", title: "Physics" }],
    });

    const asked = await createGoals({
      dailyMinutes: 5,
      goals: [
        {
          details: { question: "how does a microwave work?" },
          kind: "explain",
          language: "en",
          prompt: "how does a microwave work?",
          title: "How a microwave works",
        },
      ],
    });

    expect(asked.status).toBe("created");

    const [profile, usage] = await Promise.all([
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.usageRecord.findMany({
        orderBy: { kind: "asc" },
        select: { costMicros: true, generated: true, kind: true },
        where: { userId: user.id },
      }),
    ]);

    expect(followed.status === "created" && profile.activeGoalId).toBe(
      followed.status === "created" ? followed.goals[0]?.id : null,
    );

    // Every question asks a model (to classify and find it, if not to write it), so it costs AI.
    expect(usage).toStrictEqual([
      {
        costMicros: getEstimatedCostMicros({ generated: true, kind: "explanation" }),
        generated: true,
        kind: "explanation",
      },
      {
        costMicros: getEstimatedCostMicros({ generated: false, kind: "goal" }),
        generated: false,
        kind: "goal",
      },
    ]);

    expect(usage.every((record) => record.costMicros > 0)).toBe(true);
  });
});
