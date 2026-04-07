import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationInterpretationsStep } from "./generate-investigation-interpretations-step";

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

const { generateActivityInvestigationInterpretationsMock } = vi.hoisted(() => ({
  generateActivityInvestigationInterpretationsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-interpretations", () => ({
  generateActivityInvestigationInterpretations: generateActivityInvestigationInterpretationsMock,
}));

function makeMockInterpretation(prefix: string) {
  return {
    data: {
      best: { feedback: `${prefix} best feedback`, text: `${prefix} best text` },
      dismissive: { feedback: `${prefix} dismissive feedback`, text: `${prefix} dismissive text` },
      overclaims: { feedback: `${prefix} overclaims feedback`, text: `${prefix} overclaims text` },
    },
  };
}

describe(generateInvestigationInterpretationsStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Interpretations Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 2D interpretation array [findingIndex][explanationIndex]", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Interpretations ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const findings = ["Finding A", "Finding B"];
    const explanations = ["Explanation 1", "Explanation 2"];

    const mock_f0_e0 = makeMockInterpretation("f0e0");
    const mock_f0_e1 = makeMockInterpretation("f0e1");
    const mock_f1_e0 = makeMockInterpretation("f1e0");
    const mock_f1_e1 = makeMockInterpretation("f1e1");

    // The step calls flatMap(findings, explanations) so calls are:
    // (finding0, explanation0), (finding0, explanation1), (finding1, explanation0), (finding1, explanation1)
    generateActivityInvestigationInterpretationsMock
      .mockResolvedValueOnce(mock_f0_e0)
      .mockResolvedValueOnce(mock_f0_e1)
      .mockResolvedValueOnce(mock_f1_e0)
      .mockResolvedValueOnce(mock_f1_e1);

    const result = await generateInvestigationInterpretationsStep({
      activityId: Number(dbActivity.id),
      explanations,
      findings,
      language: "en",
      scenario: "The scenario text",
    });

    expect(result).toHaveLength(2);
    expect(result![0]).toHaveLength(2);
    expect(result![1]).toHaveLength(2);

    // [findingIndex][explanationIndex]
    expect(result![0]![0]).toEqual(mock_f0_e0.data);
    expect(result![0]![1]).toEqual(mock_f0_e1.data);
    expect(result![1]![0]).toEqual(mock_f1_e0.data);
    expect(result![1]![1]).toEqual(mock_f1_e1.data);
  });

  test("calls AI task once per (finding, explanation) pair", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Interpretations Calls ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const findings = ["Finding A", "Finding B"];
    const explanations = ["Explanation 1", "Explanation 2"];

    generateActivityInvestigationInterpretationsMock.mockResolvedValue(
      makeMockInterpretation("generic"),
    );

    await generateInvestigationInterpretationsStep({
      activityId: Number(dbActivity.id),
      explanations,
      findings,
      language: "pt",
      scenario: "The scenario",
    });

    // 2 findings x 2 explanations = 4 calls
    expect(generateActivityInvestigationInterpretationsMock).toHaveBeenCalledTimes(4);

    expect(generateActivityInvestigationInterpretationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: "Explanation 1",
        finding: "Finding A",
        language: "pt",
        scenario: "The scenario",
      }),
    );

    expect(generateActivityInvestigationInterpretationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: "Explanation 2",
        finding: "Finding B",
        language: "pt",
        scenario: "The scenario",
      }),
    );
  });

  test("returns null when any individual interpretation call fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Interpretations Fail ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const findings = ["Finding A", "Finding B"];
    const explanations = ["Explanation 1", "Explanation 2"];

    generateActivityInvestigationInterpretationsMock
      .mockResolvedValueOnce(makeMockInterpretation("ok1"))
      .mockRejectedValueOnce(new Error("AI failed"))
      .mockResolvedValueOnce(makeMockInterpretation("ok2"))
      .mockResolvedValueOnce(makeMockInterpretation("ok3"));

    const result = await generateInvestigationInterpretationsStep({
      activityId: Number(dbActivity.id),
      explanations,
      findings,
      language: "en",
      scenario: "The scenario",
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "error",
        step: "generateInvestigationInterpretations",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Interpretations Stream ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationInterpretationsMock.mockResolvedValue(
      makeMockInterpretation("ok"),
    );

    await generateInvestigationInterpretationsStep({
      activityId: Number(dbActivity.id),
      explanations: ["Explanation 1", "Explanation 2"],
      findings: ["Finding A", "Finding B"],
      language: "en",
      scenario: "The scenario",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "started",
        step: "generateInvestigationInterpretations",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "completed",
        step: "generateInvestigationInterpretations",
      }),
    );
  });
});
