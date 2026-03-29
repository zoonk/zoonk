import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateChallengeContentStep } from "./generate-challenge-content-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

const { generateActivityChallengeMock } = vi.hoisted(() => ({
  generateActivityChallengeMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/challenge", () => ({
  generateActivityChallenge: generateActivityChallengeMock,
}));

describe(generateChallengeContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Challenge Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns challenge data for a valid activity with concepts", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Challenge Content ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const challengeData = {
      intro: "Welcome to the challenge",
      reflection: "Great reflection",
      steps: [
        {
          context: "You face a decision",
          options: [
            {
              consequence: "Good outcome",
              effects: [{ dimension: "trust", impact: "positive" }],
              text: "Option A",
            },
          ],
          question: "What do you do?",
        },
      ],
    };

    generateActivityChallengeMock.mockResolvedValue({ data: challengeData });

    const result = await generateChallengeContentStep(activity, ["concept1"], ["neighbor1"]);

    expect(result.activityId).toBe(activity.id);
    expect(result.data).toEqual(challengeData);
  });

  test("marks activity as failed and returns null when concepts are empty", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Challenge No Concepts ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    const result = await generateChallengeContentStep(activity, [], []);

    expect(result).toEqual({ activityId: null, data: null });
    expect(generateActivityChallengeMock).not.toHaveBeenCalled();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("marks activity as failed when AI returns empty steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Challenge Empty Steps ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    generateActivityChallengeMock.mockResolvedValue({
      data: { intro: "", reflection: "", steps: [] },
    });

    const result = await generateChallengeContentStep(activity, ["concept"], []);

    expect(result).toEqual({ activityId: null, data: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Challenge Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    generateActivityChallengeMock.mockResolvedValue({
      data: {
        intro: "Intro",
        reflection: "Reflection",
        steps: [
          {
            context: "Context",
            options: [{ consequence: "c", effects: [], text: "t" }],
            question: "q",
          },
        ],
      },
    });

    await generateChallengeContentStep(activity, ["concept"], []);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "started",
        step: "generateChallengeContent",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "completed",
        step: "generateChallengeContent",
      }),
    );
  });

  test("streams error event when AI call fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Challenge AI Error ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "challenge",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Challenge ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const activity = activities[0]!;

    generateActivityChallengeMock.mockRejectedValue(new Error("AI failed"));

    await generateChallengeContentStep(activity, ["concept"], []);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: activity.id,
        status: "error",
        step: "generateChallengeContent",
      }),
    );
  });
});
