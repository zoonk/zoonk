import { randomUUID } from "node:crypto";
import { generateActivityCustom } from "@zoonk/ai/tasks/activities/custom";
import { type generateStepVisualDescriptions } from "@zoonk/ai/tasks/steps/visual-descriptions";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "./activity-generation-workflow";
import { type dispatchVisualContent } from "./steps/_utils/dispatch-visual-content";

function createDescriptionsResult(
  steps: { title: string; text: string }[],
): Awaited<ReturnType<typeof generateStepVisualDescriptions>> {
  return {
    data: {
      descriptions: steps.map((step, index) =>
        index === 0
          ? { description: `A visual prompt for ${step.title}`, kind: "image" as const }
          : { description: `A code snippet for ${step.title}`, kind: "code" as const },
      ),
    },
    systemPrompt: "test",
    usage: {} as Awaited<ReturnType<typeof generateStepVisualDescriptions>>["usage"],
    userPrompt: "test",
  };
}

function createDispatchResult(
  descriptions: { kind: string; description: string }[],
): Awaited<ReturnType<typeof dispatchVisualContent>> {
  return descriptions.map((desc, index) =>
    index === 0
      ? { kind: "image", prompt: desc.description, url: "https://example.com/image.webp" }
      : { annotations: null, code: "const x = 1;", kind: "code", language: "typescript" },
  );
}

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
          concept: "Small chunks",
          options: [
            {
              feedback: "Yes. The same chunk still needs different labels for different jobs.",
              isCorrect: true,
              text: "To give each layer the information it needs",
            },
            {
              feedback: "Not this one. The labels are functional, not decorative.",
              isCorrect: false,
              text: "To make the packet look tidier",
            },
          ],
          question: "Why can one packet still carry more than one label?",
        },
      ],
      scenario: {
        text: "You send a photo on WhatsApp while riding the bus and it still reaches your friend after crossing many network points.",
        title: "On WhatsApp",
      },
    },
  };
}

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue(createExplanationResult()),
}));

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: vi.fn().mockResolvedValue({ data: { steps: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/quiz", () => ({
  generateActivityQuiz: vi.fn().mockResolvedValue({ data: { questions: [] } }),
}));

vi.mock("@zoonk/ai/tasks/activities/custom", () => ({
  generateActivityCustom: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Custom step 1 text", title: "Custom Step 1" },
        { text: "Custom step 2 text", title: "Custom Step 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/steps/visual-descriptions", () => ({
  generateStepVisualDescriptions: vi
    .fn()
    .mockImplementation(({ steps }: { steps: { title: string; text: string }[] }) =>
      Promise.resolve(createDescriptionsResult(steps)),
    ),
}));

vi.mock("./steps/_utils/dispatch-visual-content", () => ({
  dispatchVisualContent: vi
    .fn()
    .mockImplementation(
      ({ descriptions }: { descriptions: { kind: string; description: string }[] }) =>
        Promise.resolve(createDispatchResult(descriptions)),
    ),
}));

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi.fn().mockResolvedValue({
    data: "https://example.com/quiz-image.webp",
    error: null,
  }),
}));

describe("custom activity workflow", () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Test Chapter ${randomUUID()}`,
    });
  });

  test("one custom activity fails while others still complete", async () => {
    vi.mocked(generateActivityCustom).mockImplementation(({ activityTitle }) => {
      if (activityTitle.startsWith("Failing Custom")) {
        return Promise.reject(new Error("First custom failed"));
      }

      return Promise.resolve({
        data: {
          steps: [{ text: "Second succeeds", title: "Second Custom" }],
        },
        systemPrompt: "test",
        // oxlint-disable-next-line no-unsafe-type-assertion -- test mock
        usage: {} as Awaited<ReturnType<typeof generateActivityCustom>>["usage"],
        userPrompt: "test",
      });
    });

    const testLesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "custom",
      organizationId,
      title: `Custom Isolation Lesson ${randomUUID()}`,
    });

    const [failingCustom, succeedingCustom] = await Promise.all([
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        lessonId: testLesson.id,
        organizationId,
        position: 0,
        title: `Failing Custom ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "pending",
        kind: "custom",
        lessonId: testLesson.id,
        organizationId,
        position: 1,
        title: `Succeeding Custom ${randomUUID()}`,
      }),
    ]);

    await activityGenerationWorkflow(testLesson.id);

    const [dbFailing, dbSucceeding] = await Promise.all([
      prisma.activity.findUnique({ where: { id: failingCustom.id } }),
      prisma.activity.findUnique({ where: { id: succeedingCustom.id } }),
    ]);

    expect(dbFailing?.generationStatus).toBe("failed");
    expect(dbSucceeding?.generationStatus).toBe("completed");
  });
});
