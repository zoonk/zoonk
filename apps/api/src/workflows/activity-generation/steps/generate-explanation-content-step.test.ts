import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateExplanationContentStep } from "./generate-explanation-content-step";

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

const { generateActivityExplanationMock } = vi.hoisted(() => ({
  generateActivityExplanationMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: generateActivityExplanationMock,
}));

/**
 * The explanation task returns a structured object now, and multiple tests
 * need the same realistic payload. Keeping it at module scope avoids
 * recreating the helper per test while making the expected learner flow easy
 * to reuse.
 */
function createExplanationResult() {
  return {
    data: {
      anchor: {
        text: "This is why Google Maps can recalculate your route quickly.",
        title: "Fast route updates",
      },
      concepts: [
        {
          text: "Packets travel as smaller chunks so each network step can handle them reliably.",
          title: "Small chunks",
          visual: null,
        },
        {
          text: "Each layer adds its own label for a different job.",
          title: "Layer labels",
          visual: {
            description: "A diagram of one packet with stacked layer labels.",
            kind: "diagram" as const,
          },
        },
      ],
      initialQuestion: {
        explanation:
          "The message gets wrapped in layers of instructions so each part of the network knows what to do next.",
        question: "Why doesn't internet data travel as one giant unlabeled blob?",
        visual: {
          description: "An image of a message turning into a labeled packet.",
          kind: "image" as const,
        },
      },
      predict: [
        {
          concept: "Small chunks",
          options: [
            {
              feedback: "Right. Smaller chunks are easier for the network to handle.",
              isCorrect: true,
              text: "Because the network handles smaller pieces more predictably",
            },
            {
              feedback: "No. The goal is handling and routing, not decoration.",
              isCorrect: false,
              text: "Because it looks more organized on screen",
            },
          ],
          question: "Why break the message into packets?",
        },
        {
          concept: "Layer labels",
          options: [
            {
              feedback: "Yes. Different layers need different details.",
              isCorrect: true,
              text: "Because each layer needs its own information",
            },
            {
              feedback: "Not this one. The point is function, not aesthetics.",
              isCorrect: false,
              text: "Because more labels make the packet prettier",
            },
          ],
          question: "Why add more than one label?",
        },
      ],
      scenario: {
        text: "You send a photo on WhatsApp while riding the bus and it still reaches your friend after passing through many network points.",
        title: "On WhatsApp",
      },
    },
  };
}

describe(generateExplanationContentStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Explanation Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns explanation results for each activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Explanation Content ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Concept A ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Concept B ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityExplanationMock.mockResolvedValue(createExplanationResult());

    const concepts = activities.map((a) => a.title ?? "");
    const neighboringConcepts = ["neighbor1"];

    const result = await generateExplanationContentStep(activities, concepts, neighboringConcepts);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.activityId).toBe(activities[0]?.id);
    expect(result.results[0]?.steps).toEqual([
      {
        text: "Why doesn't internet data travel as one giant unlabeled blob?",
        title: "",
      },
      {
        text: "The message gets wrapped in layers of instructions so each part of the network knows what to do next.",
        title: "",
      },
      {
        text: "You send a photo on WhatsApp while riding the bus and it still reaches your friend after passing through many network points.",
        title: "On WhatsApp",
      },
      {
        text: "Packets travel as smaller chunks so each network step can handle them reliably.",
        title: "Small chunks",
      },
      {
        text: "Each layer adds its own label for a different job.",
        title: "Layer labels",
      },
      {
        text: "This is why Google Maps can recalculate your route quickly.",
        title: "Fast route updates",
      },
    ]);
    expect(result.results[0]?.plan.map((entry) => entry.kind)).toEqual([
      "static",
      "visual",
      "static",
      "static",
      "static",
      "multipleChoice",
      "static",
      "visual",
      "multipleChoice",
      "static",
    ]);
    expect(result.results[1]?.activityId).toBe(activities[1]?.id);
  });

  test("returns empty results when activities list is empty", async () => {
    const result = await generateExplanationContentStep([], ["concept"], ["neighbor"]);
    expect(result).toEqual({ results: [] });
  });

  test("streams started and completed events", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Explanation Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Stream Concept ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityExplanationMock.mockResolvedValue(createExplanationResult());

    await generateExplanationContentStep(activities, ["concept"], []);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateExplanationContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateExplanationContent" }),
    );
  });

  test("streams error status when some AI calls fail", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Explanation Error ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Good Concept ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        position: 1,
        title: `Bad Concept ${randomUUID()}`,
      }),
    ]);

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityExplanationMock
      .mockResolvedValueOnce({
        data: createExplanationResult().data,
      })
      .mockRejectedValueOnce(new Error("AI failure"));

    const concepts = activities.map((a) => a.title ?? "");

    const result = await generateExplanationContentStep(activities, concepts, []);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.activityId).toBe(activities[0]?.id);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateExplanationContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateExplanationContent" }),
    );
  });
});
