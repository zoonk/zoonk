import { randomUUID } from "node:crypto";
import { generateActivityInvestigationAccuracy } from "@zoonk/ai/tasks/activities/core/investigation-accuracy";
import { generateActivityInvestigationActions } from "@zoonk/ai/tasks/activities/core/investigation-actions";
import { generateActivityInvestigationFindings } from "@zoonk/ai/tasks/activities/core/investigation-findings";
import { generateActivityInvestigationScenario } from "@zoonk/ai/tasks/activities/core/investigation-scenario";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { getString } from "@zoonk/utils/json";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { getArray } from "../../_test-utils/json-helpers";
import { getLessonActivitiesStep } from "../steps/get-lesson-activities-step";
import { investigationActivityWorkflow } from "./investigation-workflow";

const { mockScenario, mockAccuracy, mockActions, mockFindings } = vi.hoisted(() => ({
  mockAccuracy: {
    accuracies: [
      { accuracy: "best" as const, feedback: "This is the most complete explanation." },
      { accuracy: "partial" as const, feedback: "This has some truth but misses the key insight." },
      { accuracy: "wrong" as const, feedback: "This sounds plausible but is incorrect." },
    ],
  },
  mockActions: {
    actions: [
      { label: "Check the logs", quality: "critical" as const },
      { label: "Interview workers", quality: "useful" as const },
      { label: "Look at the ceiling", quality: "weak" as const },
    ],
  },
  mockFindings: {
    findings: [
      "The logs show unusual activity at 3am.",
      "Workers report hearing a strange noise.",
      "The ceiling has a small crack.",
    ],
  },
  mockScenario: {
    explanations: [
      "Explanation A is correct",
      "Explanation B is partial",
      "Explanation C is wrong",
    ],
    scenario: "A mysterious event happened in a factory.",
    title: "Who froze the payment queue?",
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

describe("investigation activity workflow", () => {
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
      title: `Inv WF Chapter ${randomUUID()}`,
    });
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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(3);

    expect(steps[0]?.kind).toBe("investigation");
    expect(steps[0]?.position).toBe(0);
    expect(getString(steps[0]?.content, "variant")).toBe("problem");

    expect(steps[1]?.kind).toBe("investigation");
    expect(steps[1]?.position).toBe(1);
    expect(getString(steps[1]?.content, "variant")).toBe("action");

    expect(steps[2]?.kind).toBe("investigation");
    expect(steps[2]?.position).toBe(2);
    expect(getString(steps[2]?.content, "variant")).toBe("call");

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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });

    expect(dbActivity?.generationStatus).toBe("completed");
    expect(dbActivity?.generationRunId).toBe("test-run-id");
    expect(dbActivity?.title).toBe(mockScenario.title);
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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const problemStep = await prisma.step.findFirst({
      where: { activityId: activity.id, position: 0 },
    });

    expect(getString(problemStep?.content, "scenario")).toBe(mockScenario.scenario);
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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

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
    expect(getString(actions[0], "finding")).toBe(mockFindings.findings[0]);
  });

  test("saves correct call step content with per-explanation feedback", async () => {
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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await investigationActivityWorkflow({
      activitiesToGenerate: activities,
      workflowRunId: "test-run-id",
    });

    const callStep = await prisma.step.findFirst({
      where: { activityId: activity.id, position: 2 },
    });

    const explanations = getArray(callStep?.content, "explanations");
    expect(explanations).toHaveLength(3);
    expect(getString(explanations[0], "accuracy")).toBe("best");
    expect(getString(explanations[0], "feedback")).toBe("This is the most complete explanation.");
    expect(getString(explanations[1], "accuracy")).toBe("partial");
    expect(getString(explanations[2], "accuracy")).toBe("wrong");
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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await expect(
      investigationActivityWorkflow({
        activitiesToGenerate: activities,
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("AI failed");

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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await expect(
      investigationActivityWorkflow({
        activitiesToGenerate: activities,
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("AI failed");

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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await expect(
      investigationActivityWorkflow({
        activitiesToGenerate: activities,
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("AI failed");

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

    const activities = await getLessonActivitiesStep({ lessonId: lesson.id });

    await expect(
      investigationActivityWorkflow({
        activitiesToGenerate: activities,
        workflowRunId: "test-run-id",
      }),
    ).rejects.toThrow("AI failed");

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });
});
