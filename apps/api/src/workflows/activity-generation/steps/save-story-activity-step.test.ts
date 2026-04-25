import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { getString } from "@zoonk/utils/json";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveStoryActivityStep } from "./save-story-activity-step";

const writeMock = vi.fn().mockResolvedValue(null);

type StepContentWithChoices = {
  choices?: { id?: string; text?: string }[];
  image?: { url?: string };
};

type StepContentWithImage = {
  image?: { url?: string };
};

type StepContentWithOutcomes = {
  metrics?: { label?: string }[];
  outcomes?: { perfect?: { image?: { url?: string } } };
};

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

const storyData = {
  intro: "You are a factory manager facing a crisis.",
  introImagePrompt: "Factory floor with anxious workers waiting for direction",
  metrics: ["Production", "Morale", "Cash"],
  outcomes: {
    bad: {
      imagePrompt: "Factory floor mixed between wins and unresolved trouble spots",
      narrative: "Some decisions landed well, but the system still feels uneven.",
      title: "Mixed recovery",
    },
    good: {
      imagePrompt: "Factory floor stabilizing with some strain still visible",
      narrative: "You regained control with a few scars left from the crisis.",
      title: "Solid recovery",
    },
    ok: {
      imagePrompt: "Factory floor partly moving while the team still clears delays",
      narrative: "You kept the crisis contained, but recovery is uneven.",
      title: "Partial recovery",
    },
    perfect: {
      imagePrompt: "Recovered factory floor with confident workers and steady output",
      narrative: "You turned crisis into opportunity.",
      title: "Excellent",
    },
    terrible: {
      imagePrompt: "Factory floor still strained with missed output and tired workers",
      narrative: "The crisis overwhelmed you.",
      title: "Needs work",
    },
  },
  steps: [
    {
      choices: [
        {
          alignment: "strong" as const,
          consequence: "Workers rally behind you.",
          label: "Address the team directly",
          metricEffects: [{ effect: "positive" as const, metric: "Morale" }],
          stateImagePrompt: "Factory floor after a direct address calms the team",
        },
        {
          alignment: "weak" as const,
          consequence: "Rumors spread.",
          label: "Send an email",
          metricEffects: [{ effect: "negative" as const, metric: "Morale" }],
          stateImagePrompt: "Factory floor after a vague email leaves workers confused",
        },
      ],
      imagePrompt: "Factory floor with halted lines and empty parts bins",
      problem: "Your supplier went bankrupt.",
    },
    {
      choices: [
        {
          alignment: "partial" as const,
          consequence: "Reasonable alternative found.",
          label: "Contact backup suppliers",
          metricEffects: [{ effect: "positive" as const, metric: "Production" }],
          stateImagePrompt: "Temporary supply shipment arriving at the factory loading dock",
        },
        {
          alignment: "strong" as const,
          consequence: "Innovation emerges.",
          label: "Redesign the product",
          metricEffects: [
            { effect: "positive" as const, metric: "Production" },
            { effect: "positive" as const, metric: "Cash" },
          ],
          stateImagePrompt:
            "Factory team adapting the product with new materials and renewed momentum",
        },
      ],
      imagePrompt: "Production area paused while engineers debate how to proceed without parts",
      problem: "Production is halted.",
    },
  ],
  title: "The night the labels got swapped",
};

const storyImages = {
  choiceStateImages: [
    [
      { prompt: "State 1A", url: "https://example.com/state-1a.webp" },
      { prompt: "State 1B", url: "https://example.com/state-1b.webp" },
    ],
    [
      { prompt: "State 2A", url: "https://example.com/state-2a.webp" },
      { prompt: "State 2B", url: "https://example.com/state-2b.webp" },
    ],
  ],
  introImage: {
    prompt: "Story intro",
    url: "https://example.com/story-intro.webp",
  },
  outcomeImages: {
    bad: { prompt: "Outcome bad", url: "https://example.com/outcome-bad.webp" },
    good: { prompt: "Outcome good", url: "https://example.com/outcome-good.webp" },
    ok: { prompt: "Outcome ok", url: "https://example.com/outcome-ok.webp" },
    perfect: { prompt: "Outcome perfect", url: "https://example.com/outcome-perfect.webp" },
    terrible: { prompt: "Outcome terrible", url: "https://example.com/outcome-terrible.webp" },
  },
  stepImages: [
    { prompt: "Story step 1", url: "https://example.com/step-1.webp" },
    { prompt: "Story step 2", url: "https://example.com/step-2.webp" },
  ],
};

const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

describe(saveStoryActivityStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Story Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Creates a fresh story activity, runs the save step, and returns the
   * persisted records so assertions can focus on output instead of setup.
   */
  async function saveGeneratedStory() {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Story ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: null,
    });

    await saveStoryActivityStep({
      activityId: activity.id,
      storyData,
      storyImages,
      workflowRunId: "workflow-1",
    });

    const [dbSteps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: activity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: activity.id },
      }),
    ]);

    return { dbActivity, dbSteps };
  }

  test("saves intro, decision steps, and outcome with correct kinds and positions", async () => {
    const { dbActivity, dbSteps } = await saveGeneratedStory();
    const introStep = dbSteps[0]!;
    const firstDecisionStep = dbSteps[1]!;
    const secondDecisionStep = dbSteps[2]!;
    const outcomeStep = dbSteps[3]!;
    const introContent = introStep.content as StepContentWithImage;
    const firstDecisionContent = firstDecisionStep.content as StepContentWithChoices;
    const outcomeContent = outcomeStep.content as StepContentWithOutcomes;

    // 1 intro + 2 decision steps + 1 outcome = 4
    expect(dbSteps).toHaveLength(4);

    // Intro: static with intro variant at position 0
    expect(introStep.kind).toBe("static");
    expect(introStep.position).toBe(0);
    expect(getString(introStep.content, "variant")).toBe("intro");
    expect(getString(introStep.content, "title")).toBe(storyData.title);
    expect(introStep.content).not.toHaveProperty("metrics");
    expect(introContent.image?.url).toBe("https://example.com/story-intro.webp");

    // Decision steps: story kind at positions 1 and 2
    expect(firstDecisionStep.kind).toBe("story");
    expect(firstDecisionStep.position).toBe(1);
    expect(firstDecisionContent.image?.url).toBe("https://example.com/step-1.webp");
    expect(firstDecisionContent.choices?.map((choice) => choice.id)).toEqual([
      expect.stringMatching(uuidPattern),
      expect.stringMatching(uuidPattern),
    ]);
    expect(firstDecisionContent.choices?.map((choice) => choice.text)).toEqual([
      "Address the team directly",
      "Send an email",
    ]);
    expect(secondDecisionStep.kind).toBe("story");
    expect(secondDecisionStep.position).toBe(2);

    // Outcome: static with storyOutcome variant at position 3
    expect(outcomeStep.kind).toBe("static");
    expect(outcomeStep.position).toBe(3);
    expect(getString(outcomeStep.content, "variant")).toBe("storyOutcome");
    expect(outcomeContent.metrics?.map((metric) => metric.label)).toEqual(storyData.metrics);
    expect(outcomeContent.outcomes?.perfect?.image?.url).toBe(
      "https://example.com/outcome-perfect.webp",
    );

    // All steps are published
    for (const step of dbSteps) {
      expect(step.isPublished).toBe(true);
    }

    // Activity marked as completed with generationRunId
    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
      title: storyData.title,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveStoryActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveStoryActivity" }),
    );
  });

  test("throws DB errors without streaming an error status", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Story Error ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "story",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Story Fail ${randomUUID()}`,
    });

    // Delete the activity so the prisma.activity.update inside the transaction fails
    await prisma.activity.delete({ where: { id: activity.id } });

    await expect(
      saveStoryActivityStep({
        activityId: activity.id,
        storyData,
        storyImages,
        workflowRunId: "workflow-error",
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "saveStoryActivity" }),
    );
  });
});
