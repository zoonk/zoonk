import { randomUUID } from "node:crypto";
import { generateActivityInvestigationAccuracy } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { generateActivityInvestigationActions } from "@zoonk/ai/tasks/activities/core/investigation-actions";
import { generateActivityInvestigationDebrief } from "@zoonk/ai/tasks/activities/core/investigation-debrief";
import { generateActivityInvestigationFindings } from "@zoonk/ai/tasks/activities/core/investigation-findings";
import { generateActivityInvestigationInterpretations } from "@zoonk/ai/tasks/activities/core/investigation-interpretations";
import { generateActivityInvestigationScenario } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { generateInvestigationVisual } from "@zoonk/ai/tasks/activities/core/investigation-visuals";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { getString } from "@zoonk/utils/json";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getArray } from "../../_test-utils/json-helpers";
import { dispatchVisualContent } from "../steps/_utils/dispatch-visual-content";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { investigationActivityWorkflow } from "./investigation-workflow";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

const {
  mockScenario,
  mockAccuracy,
  mockActions,
  mockFindings,
  mockInterpretations,
  mockDebrief,
  mockVisual,
  mockDispatchedVisual,
} = vi.hoisted(() => ({
  mockAccuracy: {
    accuracies: ["best" as const, "partial" as const, "wrong" as const],
  },
  mockActions: {
    actions: [
      { label: "Check the logs", quality: "critical" as const },
      { label: "Interview workers", quality: "useful" as const },
      { label: "Look at the ceiling", quality: "weak" as const },
    ],
  },
  mockDebrief: {
    fullExplanation: "The factory incident was caused by a power surge that triggered the alarm.",
  },
  mockDispatchedVisual: {
    chartType: "line",
    data: [{ name: "3am", value: 95 }],
    kind: "chart",
    title: "Factory Activity",
  },
  mockFindings: {
    findings: [
      "The logs show unusual activity at 3am.",
      "Workers report hearing a strange noise.",
      "The ceiling has a small crack.",
    ],
  },
  mockInterpretations: {
    best: { feedback: "Good reading.", text: "This evidence points toward..." },
    dismissive: { feedback: "You're ignoring key details.", text: "This doesn't matter..." },
    overclaims: { feedback: "You're overreading this.", text: "This proves everything..." },
  },
  mockScenario: {
    explanations: [
      "Explanation A is correct",
      "Explanation B is partial",
      "Explanation C is wrong",
    ],
    scenario: "A mysterious event happened in a factory.",
  },
  mockVisual: {
    description: "A chart showing factory activity over time.",
    kind: "chart" as const,
  },
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-scenario", () => ({
  generateActivityInvestigationScenario: vi.fn().mockResolvedValue({ data: mockScenario }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-accuracy", () => ({
  generateActivityInvestigationAccuracy: vi.fn().mockResolvedValue({ data: mockAccuracy }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-actions", () => ({
  generateActivityInvestigationActions: vi.fn().mockResolvedValue({ data: mockActions }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-findings", () => ({
  generateActivityInvestigationFindings: vi.fn().mockResolvedValue({ data: mockFindings }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-interpretations", () => ({
  generateActivityInvestigationInterpretations: vi
    .fn()
    .mockResolvedValue({ data: mockInterpretations }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-debrief", () => ({
  generateActivityInvestigationDebrief: vi.fn().mockResolvedValue({ data: mockDebrief }),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-visuals", () => ({
  generateInvestigationVisual: vi.fn().mockResolvedValue({ data: mockVisual }),
}));

vi.mock("../steps/_utils/dispatch-visual-content", () => ({
  dispatchVisualContent: vi.fn().mockResolvedValue([
    mockDispatchedVisual, // scenario visual
    mockDispatchedVisual, // finding 0 visual
    mockDispatchedVisual, // finding 1 visual
    mockDispatchedVisual, // finding 2 visual
  ]),
}));

describe("investigation activity workflow", () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Inv WF Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates investigation steps with correct structure", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Critical Thinking", "Evidence Analysis"],
      organizationId,
      title: `Inv Full Pipeline ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(5);

    expect(steps[0]?.kind).toBe("investigation");
    expect(steps[0]?.position).toBe(0);
    expect(getString(steps[0]?.content, "variant")).toBe("problem");

    expect(steps[1]?.kind).toBe("investigation");
    expect(steps[1]?.position).toBe(1);
    expect(getString(steps[1]?.content, "variant")).toBe("action");

    expect(steps[2]?.kind).toBe("investigation");
    expect(steps[2]?.position).toBe(2);
    expect(getString(steps[2]?.content, "variant")).toBe("evidence");

    expect(steps[3]?.kind).toBe("investigation");
    expect(steps[3]?.position).toBe(3);
    expect(getString(steps[3]?.content, "variant")).toBe("call");

    expect(steps[4]?.kind).toBe("static");
    expect(steps[4]?.position).toBe(4);
    expect(getString(steps[4]?.content, "variant")).toBe("investigationScore");

    for (const step of steps) {
      expect(step.isPublished).toBe(true);
    }
  });

  test("marks investigation as completed with generationRunId", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Completed ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
  });

  test("saves correct problem step content", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Problem ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const problemStep = await prisma.step.findFirst({
      where: { activityId: activity.id, position: 0 },
    });

    expect(getString(problemStep?.content, "scenario")).toBe(mockScenario.scenario);

    const explanations = getArray(problemStep?.content, "explanations");
    expect(explanations).toHaveLength(3);
    expect(getString(explanations[0], "text")).toBe("Explanation A is correct");
    expect(getString(explanations[0], "accuracy")).toBe("best");
    expect(getString(explanations[1], "accuracy")).toBe("partial");
    expect(getString(explanations[2], "accuracy")).toBe("wrong");
  });

  test("saves correct action step content", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Actions ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const actionStep = await prisma.step.findFirst({
      where: { activityId: activity.id, position: 1 },
    });

    const actions = getArray(actionStep?.content, "actions");
    expect(actions).toHaveLength(3);
    expect(getString(actions[0], "label")).toBe("Check the logs");
    expect(getString(actions[0], "quality")).toBe("critical");
  });

  test("saves correct evidence step content with interpretations and visuals", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Evidence ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const evidenceStep = await prisma.step.findFirst({
      where: { activityId: activity.id, position: 2 },
    });

    const findings = getArray(evidenceStep?.content, "findings");
    expect(findings).toHaveLength(3);
    expect(getString(findings[0], "text")).toBe(mockFindings.findings[0]);

    // Each finding should have interpretations (one per explanation)
    const interpretations = getArray(findings[0], "interpretations");
    expect(interpretations).toHaveLength(3);
  });

  test("saves correct call step content with debrief", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Call ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const callStep = await prisma.step.findFirst({
      where: { activityId: activity.id, position: 3 },
    });

    expect(getString(callStep?.content, "fullExplanation")).toBe(mockDebrief.fullExplanation);

    const explanations = getArray(callStep?.content, "explanations");
    expect(explanations).toHaveLength(3);
    expect(getString(explanations[0], "accuracy")).toBe("best");
  });

  test("skips when no investigation activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    expect(generateActivityInvestigationScenario).not.toHaveBeenCalled();
  });

  test("marks as failed when scenario generation throws", async () => {
    vi.mocked(generateActivityInvestigationScenario).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Scenario Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityInvestigationAccuracy).not.toHaveBeenCalled();
  });

  test("marks as failed when accuracy generation throws", async () => {
    vi.mocked(generateActivityInvestigationAccuracy).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Accuracy Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityInvestigationScenario).toHaveBeenCalled();
    expect(generateActivityInvestigationActions).not.toHaveBeenCalled();
  });

  test("marks as failed when actions generation throws", async () => {
    vi.mocked(generateActivityInvestigationActions).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Actions Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityInvestigationFindings).not.toHaveBeenCalled();
  });

  test("marks as failed when findings generation throws", async () => {
    vi.mocked(generateActivityInvestigationFindings).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Findings Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
    expect(generateActivityInvestigationDebrief).not.toHaveBeenCalled();
    expect(generateActivityInvestigationInterpretations).not.toHaveBeenCalled();
  });

  test("marks as failed when debrief generation throws in parallel tier", async () => {
    vi.mocked(generateActivityInvestigationDebrief).mockRejectedValueOnce(
      new Error("Debrief failed"),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Debrief Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("marks as failed when interpretations generation throws in parallel tier", async () => {
    vi.mocked(generateActivityInvestigationInterpretations).mockRejectedValueOnce(
      new Error("Interpretations failed"),
    );

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Interp Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("marks as failed when visual descriptions generation throws in parallel tier", async () => {
    vi.mocked(generateInvestigationVisual).mockRejectedValueOnce(new Error("Visuals failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Visuals Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("marks as failed when visual content dispatch throws", async () => {
    vi.mocked(dispatchVisualContent).mockRejectedValueOnce(new Error("Dispatch failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Test Concept"],
      organizationId,
      title: `Inv Dispatch Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await getLessonActivitiesStep(lesson.id);

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });
});
