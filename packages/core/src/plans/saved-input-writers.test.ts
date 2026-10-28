import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { findCourseWeightsLookup, recordCourseWeights } from "../goals/course-weights-research";
import { submitChapterTestOut } from "../learner/test-out/submit-chapter-test-out";
import { holdBackLessonDraft } from "../library/generation/hold-back-lesson";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import * as refresh from "./refresh-goal-plan";

const NOW = new Date("2020-09-28T12:00:00Z");

async function setup(examBlueprintId?: string) {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      skills: [
        { area: "Math", lessons: 6 },
        { area: "Science", lessons: 6 },
      ],
    }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 12,
    details: { institution: "Test university", placementDeclined: true, targetCourse: "Medicine" },
    examBlueprintId,
    kind: examBlueprintId ? "exam" : "learn",
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-08"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  const read = () => prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
  return { goal, library, read, user };
}

describe("saved input writers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("saves course-weight reconciliation before research returns", async () => {
    const citation = { passage: "Weights", sourceId: "notice" };

    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: ["Math", "Science"].map((name) => ({
          citation,
          group: null,
          name,
          questions: 10,
          shortName: null,
          topics: [],
          weight: null,
        })),
      },
    });

    const { goal, read } = await setup(blueprint.id);
    const before = await read();
    const lookup = await findCourseWeightsLookup({ goalId: goal.id, year: 2020 });
    expect(lookup).not.toBeNull();

    await recordCourseWeights({
      finding: {
        edition: "2020",
        source: { title: "Weights", url: "https://example.com/weights" },
        status: "found",
        weights: [5, 1],
      },
      goalId: goal.id,
      lookup: lookup!,
      provenance: { model: "test/fixture", promptVersion: "test", runId: randomUUID() },
    });

    const saved = await read();
    expect(saved.inputsKey).not.toBe(before.inputsKey);
    expect(saved.summary).toMatchObject({ basis: { layoutInputVersion: saved.inputVersion } });
  });

  it("refreshes once at the end of a failed standalone test-out", async () => {
    const { goal, library, read } = await setup();

    const questions = await Promise.all(
      library.skills.map((skill) =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    );

    const before = await read();

    const result = await submitChapterTestOut({
      chapterId: library.chapters[0]!.id,
      goalId: goal.id,
      input: {
        answers: questions.map((item, index) => ({
          answer: { selectedIndex: index },
          durationMs: 10_000,
          itemId: item.id,
        })),
        requestId: randomUUID(),
        timeZone: "UTC",
      },
    });

    expect(result).toMatchObject({ outcome: { passed: false }, status: "ready" });
    const saved = await read();
    expect(saved.inputsKey).not.toBe(before.inputsKey);
    expect(saved.summary).toMatchObject({ basis: { layoutInputVersion: saved.inputVersion } });
  });

  it("retries a saved hold-back whose plan refresh failed", async () => {
    const { library, user } = await setup();
    const lesson = library.lessons[0]!;
    const workflowRunId = randomUUID();

    await prisma.lesson.update({
      data: { contentRunId: workflowRunId, contentStatus: "running", ownerId: user.id },
      where: { id: lesson.id },
    });

    const renew = vi
      .spyOn(refresh, "refreshGoalPlan")
      .mockRejectedValueOnce(new Error("Refresh interrupted"));

    const input = {
      lessonId: lesson.id,
      model: "test/fixture",
      problems: [{ problem: "Wrong answer", screen: 0 }],
      workflowRunId,
    };

    await expect(holdBackLessonDraft(input)).rejects.toThrow("Refresh interrupted");

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ setAsideAt: expect.any(Date) });

    await expect(holdBackLessonDraft(input)).resolves.toStrictEqual({ setAside: true });
    expect(renew).toHaveBeenCalledTimes(2);
  });

  it("names a held-back lesson's loss and updates its saved summary", async () => {
    const { library, read, user } = await setup();
    const lesson = library.lessons[0]!;
    const runId = randomUUID();

    await prisma.lesson.update({
      data: { contentRunId: runId, contentStatus: "running", ownerId: user.id },
      where: { id: lesson.id },
    });

    const before = await read();

    await expect(
      holdBackLessonDraft({
        lessonId: lesson.id,
        model: "test/fixture",
        problems: [{ problem: "Wrong answer", screen: 0 }],
        workflowRunId: runId,
      }),
    ).resolves.toStrictEqual({ setAside: true });

    const saved = await read();
    expect(saved.inputsKey).not.toBe(before.inputsKey);
    expect(saved.summary).toMatchObject({ basis: { layoutInputVersion: saved.inputVersion } });
    const changes = await prisma.planChange.findMany({ where: { planId: saved.id } });

    expect(changes).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            effect: expect.objectContaining({ lessonsLeftOut: [lesson.title] }),
          }),
        }),
      ]),
    );

    await expect(
      prisma.planItem.findFirst({
        where: { lessonId: lesson.id, planId: saved.id, status: "todo" },
      }),
    ).resolves.toBeNull();
  });
});
