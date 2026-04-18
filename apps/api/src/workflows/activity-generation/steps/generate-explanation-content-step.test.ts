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
        text: "Every photo you send on WhatsApp uses this exact layering — you hit send, it runs.",
        title: "Every send",
      },
      explanation: [
        {
          text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
          title: "O envio",
        },
        {
          text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
          title: "Os rótulos escondidos",
        },
        {
          text: "Here are the wrappers, in the order they get added: the app wrapper, the transport wrapper, the network wrapper. Each layer adds a label for a different job.",
          title: "A pilha",
        },
        {
          text: "Zoom in on the network wrapper: it only carries routing info — where to send next. The chat content stays sealed inside, untouched by routers.",
          title: "O rótulo de rede",
        },
      ],
      predict: [
        {
          options: [
            {
              feedback: "Yes. Each wrapper handles a different job during the trip.",
              isCorrect: true,
              text: "Because each layer needs its own information",
            },
            {
              feedback: "Not this. Layers are functional, not decorative.",
              isCorrect: false,
              text: "Because extra labels make the packet prettier",
            },
          ],
          question: "Why wrap the same photo with several labels?",
          step: "Os rótulos escondidos",
        },
        {
          options: [
            {
              feedback: "Right. Routers only read where the packet goes next.",
              isCorrect: true,
              text: "The network label",
            },
            {
              feedback: "No. Routers do not open the full chat message.",
              isCorrect: false,
              text: "The full chat content",
            },
          ],
          question: "Which part does a router mainly use?",
          step: "O rótulo de rede",
        },
      ],
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
        description: "figure out what the repeated pattern is really saying",
        generationStatus: "pending",
        kind: "explanation",
        language: "en",
        lessonId: lesson.id,
        organizationId,
        title: `Concept A ${randomUUID()}`,
      }),
      activityFixture({
        description: "test whether the explanation still holds in a new case",
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

    const result = await generateExplanationContentStep({
      activities,
      allActivities: activities,
      lessonConcepts: lesson.concepts,
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.activityId).toBe(activities[0]?.id);
    expect(result.results[0]?.steps).toEqual([
      {
        text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
        title: "O envio",
      },
      {
        text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
        title: "Os rótulos escondidos",
      },
      {
        text: "Here are the wrappers, in the order they get added: the app wrapper, the transport wrapper, the network wrapper. Each layer adds a label for a different job.",
        title: "A pilha",
      },
      {
        text: "Zoom in on the network wrapper: it only carries routing info — where to send next. The chat content stays sealed inside, untouched by routers.",
        title: "O rótulo de rede",
      },
      {
        text: "Every photo you send on WhatsApp uses this exact layering — you hit send, it runs.",
        title: "Every send",
      },
    ]);
    expect(result.results[0]?.plan.map((entry) => entry.kind)).toEqual([
      "static",
      "visual",
      "static",
      "visual",
      "multipleChoice",
      "static",
      "visual",
      "static",
      "visual",
      "multipleChoice",
      "static",
    ]);
    expect(result.results[0]?.visualSteps).toEqual([
      {
        text: "You send a photo on WhatsApp. In under a second, it appears on your friend's screen, even if you're on the bus.",
        title: "O envio",
      },
      {
        text: "Between the tap and the delivered photo, the message passes through several hidden points. Each one wraps it with a different kind of label.",
        title: "Os rótulos escondidos",
      },
      {
        text: "Here are the wrappers, in the order they get added: the app wrapper, the transport wrapper, the network wrapper. Each layer adds a label for a different job.",
        title: "A pilha",
      },
      {
        text: "Zoom in on the network wrapper: it only carries routing info — where to send next. The chat content stays sealed inside, untouched by routers.",
        title: "O rótulo de rede",
      },
    ]);
    expect(result.results[1]?.activityId).toBe(activities[1]?.id);
    expect(generateActivityExplanationMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        activityGoal: activities[0]?.description,
        activityTitle: activities[0]?.title,
        lessonConcepts: lesson.concepts,
        otherActivityTitles: [activities[1]?.title],
      }),
    );
  });

  test("returns empty results when activities list is empty", async () => {
    const result = await generateExplanationContentStep({
      activities: [],
      allActivities: [],
      lessonConcepts: ["concept"],
    });
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

    await generateExplanationContentStep({
      activities,
      allActivities: activities,
      lessonConcepts: lesson.concepts,
    });

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

    const result = await generateExplanationContentStep({
      activities,
      allActivities: activities,
      lessonConcepts: lesson.concepts,
    });

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
