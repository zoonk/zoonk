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
import { saveInvestigationActivityStep } from "./save-investigation-activity-step";

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

const mockScenario = {
  explanations: ["Best explanation text", "Wrong explanation text"],
  scenario: "A mysterious drop in website traffic occurred overnight.",
};

const mockAccuracy = {
  accuracies: ["best", "wrong"] as ("best" | "partial" | "wrong")[],
};

const mockActions = {
  actions: [
    { label: "Check server logs", quality: "critical" as const },
    { label: "Ask a colleague", quality: "weak" as const },
  ],
};

const mockFindings = {
  findings: ["Server logs show 500 errors around 2 AM.", "Colleague says nothing changed."],
};

const mockDebrief = {
  fullExplanation: "The traffic drop was caused by a CDN outage.",
};

const mockScenarioVisual = {
  chartType: "line" as const,
  data: [{ name: "Mon", value: 100 }],
  kind: "chart",
  title: "Traffic over time",
};

const mockFindingVisuals = [
  { columns: ["Time", "Code"], kind: "table", rows: [["2AM", "500"]] },
  { events: [{ date: "2025-01-01", description: "CDN down", title: "Outage" }], kind: "timeline" },
];

describe(saveInvestigationActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Investigation Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates 3 step records with correct positions and kinds", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Investigation ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    await saveInvestigationActivityStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(activity.id),
      debrief: mockDebrief,
      findingVisuals: mockFindingVisuals,
      findings: mockFindings,
      scenario: mockScenario,
      scenarioVisual: mockScenarioVisual,
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

    expect(dbSteps).toHaveLength(3);

    // Position 0: investigation/problem
    expect(dbSteps[0]?.kind).toBe("investigation");
    expect(dbSteps[0]?.position).toBe(0);
    expect(getString(dbSteps[0]?.content, "variant")).toBe("problem");
    expect(getString(dbSteps[0]?.content, "scenario")).toBe(mockScenario.scenario);

    // Position 1: investigation/action (with embedded findings)
    expect(dbSteps[1]?.kind).toBe("investigation");
    expect(dbSteps[1]?.position).toBe(1);
    expect(getString(dbSteps[1]?.content, "variant")).toBe("action");

    // Position 2: investigation/call
    expect(dbSteps[2]?.kind).toBe("investigation");
    expect(dbSteps[2]?.position).toBe(2);
    expect(getString(dbSteps[2]?.content, "variant")).toBe("call");
    expect(getString(dbSteps[2]?.content, "fullExplanation")).toBe(mockDebrief.fullExplanation);

    for (const step of dbSteps) {
      expect(step.isPublished).toBe(true);
    }

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveInvestigationActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveInvestigationActivity" }),
    );
  });

  test("embeds visual content in problem and action steps", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Investigation Visuals ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    await saveInvestigationActivityStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(activity.id),
      debrief: mockDebrief,
      findingVisuals: mockFindingVisuals,
      findings: mockFindings,
      scenario: mockScenario,
      scenarioVisual: mockScenarioVisual,
      workflowRunId: "workflow-visuals",
    });

    const dbSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    // Problem step (position 0) has the scenario visual
    const problemContent = dbSteps[0]?.content as Record<string, unknown>;
    const visual = problemContent.visual as Record<string, unknown>;
    expect(visual.kind).toBe("chart");

    // Action step (position 1) has finding visuals embedded in each action
    const actionContent = dbSteps[1]?.content as Record<string, unknown>;
    const actions = actionContent.actions as Record<string, unknown>[];
    expect(actions).toHaveLength(2);

    const action0Visual = actions[0]?.findingVisual as Record<string, unknown>;
    expect(action0Visual.kind).toBe("table");

    const action1Visual = actions[1]?.findingVisual as Record<string, unknown>;
    expect(action1Visual.kind).toBe("timeline");
  });

  test("marks activity as completed with generationRunId", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Investigation Completed ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    await saveInvestigationActivityStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(activity.id),
      debrief: mockDebrief,
      findingVisuals: mockFindingVisuals,
      findings: mockFindings,
      scenario: mockScenario,
      scenarioVisual: mockScenarioVisual,
      workflowRunId: "workflow-completed",
    });

    const dbActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });

    expect(dbActivity.generationRunId).toBe("workflow-completed");
    expect(dbActivity.generationStatus).toBe("completed");
  });

  test("streams error when DB transaction fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Save Investigation Error ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation Fail ${randomUUID()}`,
    });

    // Delete the activity so the prisma.activity.update inside the transaction fails
    await prisma.activity.delete({ where: { id: activity.id } });

    await saveInvestigationActivityStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(activity.id),
      debrief: mockDebrief,
      findingVisuals: mockFindingVisuals,
      findings: mockFindings,
      scenario: mockScenario,
      scenarioVisual: mockScenarioVisual,
      workflowRunId: "workflow-error",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveInvestigationActivity" }),
    );
  });
});
