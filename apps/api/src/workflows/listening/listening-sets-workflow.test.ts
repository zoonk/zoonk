import { randomUUID } from "node:crypto";
import { solveItems } from "@zoonk/ai/tasks/items/solve";
import { type ListeningSet } from "@zoonk/ai/tasks/listening/schema";
import { writeListeningSet } from "@zoonk/ai/tasks/listening/write-set";
import { listeningContentSchema } from "@zoonk/core/library/listening/content";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { listeningExamFixture } from "@zoonk/testing/fixtures/listening";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { generateSpeech } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskResult } from "../_test-utils/recorded-outputs";
import { solveLikeTheKeys } from "../_test-utils/solved-items";
import { serveListeningAudio } from "./_test-utils/speech";
import { listeningSetsWorkflow } from "./listening-sets-workflow";

function provenance() {
  return {
    generatedAt: new Date().toISOString(),
    latencyMs: 1,
    model: "test/model",
    promptVersion: "test-prompt",
    provider: "test",
    requestedModel: "test/model",
    runId: randomUUID(),
    usage: {},
  };
}

function writtenSet(task: string): ListeningSet {
  return {
    questions: [
      {
        context: null,
        difficulty: "medium",
        evidence: "Thursday",
        format: "trueFalse",
        isTrue: true,
        misconception: null,
        reason: "He corrects Tuesday to Thursday.",
        skill: 1,
        statement: `The hall is booked for Thursday. ${randomUUID()}`,
      },
    ],
    speakers: [{ accent: "British English", gender: "male", name: "Tom" }],
    title: "Booking a hall",
    turns: [{ speaker: "Tom", text: `${task}. Tuesday, no, sorry, Thursday. ${randomUUID()}` }],
  };
}

async function examGoal(exam: Awaited<ReturnType<typeof listeningExamFixture>>) {
  const user = await userFixture();

  return goalFixture({
    examBlueprintId: exam.blueprint.id,
    kind: "exam",
    language: "pt",
    targetLanguage: "en",
    userId: user.id,
  });
}

describe(listeningSetsWorkflow, () => {
  beforeEach(() => {
    serveListeningAudio();

    vi.mocked(solveItems).mockReset().mockImplementation(solveLikeTheKeys);

    vi.mocked(writeListeningSet)
      .mockReset()
      .mockImplementation(async (params) => ({
        data: { problems: [], set: writtenSet(params.task) },
        provenance: provenance(),
        systemPrompt: "",
        usage: {} as never,
        userPrompt: "",
      }));
  });

  it("makes one recording per part at the flex tier, and the exam's next learner pays for none", async () => {
    const exam = await listeningExamFixture();
    const [first, second] = [await examGoal(exam), await examGoal(exam)];

    await expect(listeningSetsWorkflow({ goalId: first.id, wait: "later" })).resolves.toStrictEqual(
      { status: "prepared", voiced: 2 },
    );

    expect(writeListeningSet).toHaveBeenCalledTimes(2);
    expect(generateSpeech).toHaveBeenCalledTimes(2);

    for (const [params] of vi.mocked(writeListeningSet).mock.calls) {
      expect(params).toMatchObject({ language: "pt", scriptLanguage: "en", serviceTier: "flex" });
    }

    for (const [params] of vi.mocked(generateSpeech).mock.calls) {
      expect(params).toMatchObject({
        instructions: expect.stringContaining("English"),
        providerOptions: { gateway: { serviceTier: "flex" } },
      });
    }

    const sets = await prisma.itemSet.findMany({
      where: { examBlueprintId: exam.blueprint.id, kind: "audio" },
    });

    expect(sets).toHaveLength(2);
    expect(sets.every((set) => set.mediaAssetId !== null)).toBe(true);

    await expect(
      listeningSetsWorkflow({ goalId: second.id, wait: "later" }),
    ).resolves.toStrictEqual({ status: "none", voiced: 0 });

    expect(writeListeningSet).toHaveBeenCalledTimes(2);
    expect(generateSpeech).toHaveBeenCalledTimes(2);
  });

  it("records no set whose questions' keys the solve, reading its script, doesn't reach", async () => {
    const exam = await listeningExamFixture();
    const goal = await examGoal(exam);

    vi.mocked(solveItems).mockImplementation(async () =>
      taskResult({ solutions: [{ format: "trueFalse", isTrue: false, work: "He said Tuesday." }] }),
    );

    await expect(listeningSetsWorkflow({ goalId: goal.id, wait: "later" })).resolves.toStrictEqual({
      status: "prepared",
      voiced: 0,
    });

    expect(solveItems).toHaveBeenCalledTimes(2);

    for (const [params] of vi.mocked(solveItems).mock.calls) {
      expect(params).toMatchObject({
        serviceTier: "flex",
        stimulus: expect.stringContaining("Tom: "),
      });
    }

    expect(generateSpeech).not.toHaveBeenCalled();

    await expect(
      prisma.itemSet.count({ where: { examBlueprintId: exam.blueprint.id } }),
    ).resolves.toBe(0);
  });

  it("writes a learner who heard every recording of a part a new one, for that part only", async () => {
    const exam = await listeningExamFixture();
    const goal = await examGoal(exam);

    await listeningSetsWorkflow({ goalId: goal.id, wait: "later" });

    const [heard] = await prisma.itemSet.findMany({
      include: { items: true },
      orderBy: { createdAt: "asc" },
      where: { examBlueprintId: exam.blueprint.id },
    });

    await attemptFixture({ itemId: heard?.items[0]?.id, userId: goal.userId });

    await expect(
      listeningSetsWorkflow({ goalId: goal.id, userId: goal.userId, wait: "later" }),
    ).resolves.toStrictEqual({ status: "prepared", voiced: 1 });

    expect(vi.mocked(writeListeningSet).mock.calls.at(-1)?.[0]).toMatchObject({
      task: heard ? listeningContentSchema.parse(heard.content).task : null,
    });

    expect(writeListeningSet).toHaveBeenCalledTimes(3);
  });

  it("has nothing to make for a goal without listening", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "learn", userId: user.id });

    await expect(listeningSetsWorkflow({ goalId: goal.id, wait: "later" })).resolves.toStrictEqual({
      status: "none",
      voiced: 0,
    });
  });
});
