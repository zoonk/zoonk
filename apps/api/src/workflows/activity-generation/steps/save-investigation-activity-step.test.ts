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

const mockInterpretations = [
  [
    {
      best: { feedback: "f0e0 best fb", text: "f0e0 best" },
      dismissive: { feedback: "f0e0 dismissive fb", text: "f0e0 dismissive" },
      overclaims: { feedback: "f0e0 overclaims fb", text: "f0e0 overclaims" },
    },
    {
      best: { feedback: "f0e1 best fb", text: "f0e1 best" },
      dismissive: { feedback: "f0e1 dismissive fb", text: "f0e1 dismissive" },
      overclaims: { feedback: "f0e1 overclaims fb", text: "f0e1 overclaims" },
    },
  ],
  [
    {
      best: { feedback: "f1e0 best fb", text: "f1e0 best" },
      dismissive: { feedback: "f1e0 dismissive fb", text: "f1e0 dismissive" },
      overclaims: { feedback: "f1e0 overclaims fb", text: "f1e0 overclaims" },
    },
    {
      best: { feedback: "f1e1 best fb", text: "f1e1 best" },
      dismissive: { feedback: "f1e1 dismissive fb", text: "f1e1 dismissive" },
      overclaims: { feedback: "f1e1 overclaims fb", text: "f1e1 overclaims" },
    },
  ],
];

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

  test("creates 5 step records with correct positions and kinds", async () => {
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
      interpretations: mockInterpretations,
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

    // 5 steps: problem, action, evidence, call, investigationScore
    expect(dbSteps).toHaveLength(5);

    // Position 0: investigation/problem
    expect(dbSteps[0]?.kind).toBe("investigation");
    expect(dbSteps[0]?.position).toBe(0);
    expect(getString(dbSteps[0]?.content, "variant")).toBe("problem");
    expect(getString(dbSteps[0]?.content, "scenario")).toBe(mockScenario.scenario);

    // Position 1: investigation/action
    expect(dbSteps[1]?.kind).toBe("investigation");
    expect(dbSteps[1]?.position).toBe(1);
    expect(getString(dbSteps[1]?.content, "variant")).toBe("action");

    // Position 2: investigation/evidence
    expect(dbSteps[2]?.kind).toBe("investigation");
    expect(dbSteps[2]?.position).toBe(2);
    expect(getString(dbSteps[2]?.content, "variant")).toBe("evidence");

    // Position 3: investigation/call
    expect(dbSteps[3]?.kind).toBe("investigation");
    expect(dbSteps[3]?.position).toBe(3);
    expect(getString(dbSteps[3]?.content, "variant")).toBe("call");
    expect(getString(dbSteps[3]?.content, "fullExplanation")).toBe(mockDebrief.fullExplanation);

    // Position 4: static/investigationScore
    expect(dbSteps[4]?.kind).toBe("static");
    expect(dbSteps[4]?.position).toBe(4);
    expect(getString(dbSteps[4]?.content, "variant")).toBe("investigationScore");

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
      expect.objectContaining({ status: "started", step: "saveInvestigationActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveInvestigationActivity" }),
    );
  });

  test("embeds visual content in problem and evidence steps", async () => {
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
      interpretations: mockInterpretations,
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

    // Evidence step (position 2) has finding visuals
    const evidenceContent = dbSteps[2]?.content as Record<string, unknown>;
    const findings = evidenceContent.findings as Record<string, unknown>[];
    expect(findings).toHaveLength(2);

    const finding0Visual = findings[0]?.visual as Record<string, unknown>;
    expect(finding0Visual.kind).toBe("table");

    const finding1Visual = findings[1]?.visual as Record<string, unknown>;
    expect(finding1Visual.kind).toBe("timeline");
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
      interpretations: mockInterpretations,
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
      interpretations: mockInterpretations,
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
