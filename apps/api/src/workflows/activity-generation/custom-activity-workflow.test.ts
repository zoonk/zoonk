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

vi.mock("@zoonk/ai/tasks/activities/core/explanation", () => ({
  generateActivityExplanation: vi.fn().mockResolvedValue(createExplanationResult()),
}));

vi.mock("@zoonk/ai/tasks/activities/core/practice", () => ({
  generateActivityPractice: vi.fn().mockResolvedValue({
    data: {
      scenario: {
        text: "I'm closing the support queue with Maya, and one customer report still does not line up with the refund totals.",
        title: "Night shift",
      },
      steps: [],
      title: "The game store signup mix-up",
    },
  }),
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
