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

const storySteps = {
  intro: "You are a factory manager facing a crisis.",
  metrics: ["Production", "Morale", "Cash"],
  steps: [
    {
      choices: [
        {
          alignment: "strong" as const,
          consequence: "Workers rally behind you.",
          id: "c1a",
          metricEffects: [{ effect: "positive" as const, metric: "Morale" }],
          text: "Address the team directly",
        },
        {
          alignment: "weak" as const,
          consequence: "Rumors spread.",
          id: "c1b",
          metricEffects: [{ effect: "negative" as const, metric: "Morale" }],
          text: "Send an email",
        },
      ],
      situation: "Your supplier went bankrupt.",
    },
    {
      choices: [
        {
          alignment: "partial" as const,
          consequence: "Reasonable alternative found.",
          id: "c2a",
          metricEffects: [{ effect: "positive" as const, metric: "Production" }],
          text: "Contact backup suppliers",
        },
        {
          alignment: "strong" as const,
          consequence: "Innovation emerges.",
          id: "c2b",
          metricEffects: [
            { effect: "positive" as const, metric: "Production" },
            { effect: "positive" as const, metric: "Cash" },
          ],
          text: "Redesign the product",
        },
      ],
      situation: "Production is halted.",
    },
  ],
};

const debriefData = {
  debrief: [
    { explanation: "Communication builds trust.", name: "Crisis Communication" },
    { explanation: "Constraints drive innovation.", name: "Supply Chain Resilience" },
  ],
  outcomes: [
    { minStrongChoices: 2, narrative: "You turned crisis into opportunity.", title: "Excellent" },
    { minStrongChoices: 0, narrative: "The crisis overwhelmed you.", title: "Needs work" },
  ],
};

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

  test("saves intro, decision steps, and debrief with correct kinds and positions", async () => {
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
      title: `Story ${randomUUID()}`,
    });

    await saveStoryActivityStep({
      activityId: Number(activity.id),
      debriefData,
      storySteps,
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

    // 1 intro + 2 decision steps + 1 outcome + 2 debrief concepts = 6
    expect(dbSteps).toHaveLength(6);

    // Intro: static with storyIntro variant at position 0
    expect(dbSteps[0]?.kind).toBe("static");
    expect(dbSteps[0]?.position).toBe(0);
    expect(getString(dbSteps[0]?.content, "variant")).toBe("storyIntro");

    // Decision steps: story kind at positions 1 and 2
    expect(dbSteps[1]?.kind).toBe("story");
    expect(dbSteps[1]?.position).toBe(1);
    expect(dbSteps[2]?.kind).toBe("story");
    expect(dbSteps[2]?.position).toBe(2);

    // Outcome: static with storyOutcome variant at position 3
    expect(dbSteps[3]?.kind).toBe("static");
    expect(dbSteps[3]?.position).toBe(3);
    expect(getString(dbSteps[3]?.content, "variant")).toBe("storyOutcome");

    // Debrief concepts: individual text steps at positions 4 and 5
    expect(dbSteps[4]?.kind).toBe("static");
    expect(dbSteps[4]?.position).toBe(4);
    expect(getString(dbSteps[4]?.content, "variant")).toBe("text");
    expect(getString(dbSteps[4]?.content, "title")).toBe("Crisis Communication");

    expect(dbSteps[5]?.kind).toBe("static");
    expect(dbSteps[5]?.position).toBe(5);
    expect(getString(dbSteps[5]?.content, "variant")).toBe("text");
    expect(getString(dbSteps[5]?.content, "title")).toBe("Supply Chain Resilience");

    // All steps are published
    for (const step of dbSteps) {
      expect(step.isPublished).toBe(true);
    }

    // Activity marked as completed with generationRunId
    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveStoryActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveStoryActivity" }),
    );
  });

  test("streams error and marks failed when DB transaction fails", async () => {
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

    await saveStoryActivityStep({
      activityId: Number(activity.id),
      debriefData,
      storySteps,
      workflowRunId: "workflow-error",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveStoryActivity" }),
    );
  });
});
