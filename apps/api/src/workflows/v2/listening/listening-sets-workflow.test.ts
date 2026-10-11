import { randomUUID } from "node:crypto";
import { voiceListeningScript } from "@zoonk/ai/tasks/audio/listening";
import { type ListeningSet } from "@zoonk/ai/tasks/v2/listening/schema";
import { writeListeningSet } from "@zoonk/ai/tasks/v2/listening/write-set";
import { listeningContentSchema } from "@zoonk/core/library/listening/content";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { listeningExamFixture } from "@zoonk/testing/fixtures/listening";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHook } from "workflow";
import { mockHookConflict } from "../../../../mocks/workflow";
import { listeningSetsWorkflow } from "./listening-sets-workflow";

// Writing, voicing and storing a recording are paid external services: their results are faked.
vi.mock("@zoonk/ai/tasks/v2/listening/write-set", () => ({ writeListeningSet: vi.fn() }));
vi.mock("@zoonk/ai/tasks/audio/listening", () => ({ voiceListeningScript: vi.fn() }));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://blob.test/${randomUUID()}-${pathname}`,
  })),
}));

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

/** A clean set for the part asked, so each part's script (and its reuse key) is its own. */
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
    vi.mocked(writeListeningSet)
      .mockReset()
      .mockImplementation(async (params) => ({
        data: { problems: [], set: writtenSet(params.task) },
        provenance: provenance(),
        systemPrompt: "",
        usage: {} as never,
        userPrompt: "",
      }));

    vi.mocked(voiceListeningScript)
      .mockReset()
      .mockResolvedValue({
        data: {
          audio: new Uint8Array([1, 2, 3]),
          durationMs: 30_000,
          format: "mp3",
          provenance: { ...provenance(), usage: { audioSeconds: 30 } },
        },
        error: null,
      });
  });

  it("makes one recording per part at the flex tier, and the exam's next learner pays for none", async () => {
    const exam = await listeningExamFixture();
    const [first, second] = [await examGoal(exam), await examGoal(exam)];

    await expect(listeningSetsWorkflow({ goalId: first.id, wait: "later" })).resolves.toStrictEqual(
      { status: "prepared", voiced: 2 },
    );

    expect(createHook).toHaveBeenCalledWith({ token: `listening-sets:${first.id}` });
    expect(writeListeningSet).toHaveBeenCalledTimes(2);
    expect(voiceListeningScript).toHaveBeenCalledTimes(2);

    for (const [params] of vi.mocked(writeListeningSet).mock.calls) {
      expect(params).toMatchObject({ language: "pt", scriptLanguage: "en", serviceTier: "flex" });
    }

    for (const [params] of vi.mocked(voiceListeningScript).mock.calls) {
      expect(params).toMatchObject({ language: "en", serviceTier: "flex" });
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
    expect(voiceListeningScript).toHaveBeenCalledTimes(2);
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

  it("voices a recording whose voicing failed on the next run, without writing it again", async () => {
    const exam = await listeningExamFixture();
    const goal = await examGoal(exam);

    vi.mocked(voiceListeningScript).mockResolvedValueOnce({
      data: null,
      error: new Error("All TTS providers failed"),
    });

    await expect(listeningSetsWorkflow({ goalId: goal.id, wait: "later" })).resolves.toMatchObject({
      voiced: 1,
    });

    await expect(listeningSetsWorkflow({ goalId: goal.id, wait: "later" })).resolves.toMatchObject({
      voiced: 1,
    });

    expect(writeListeningSet).toHaveBeenCalledTimes(2);
    expect(voiceListeningScript).toHaveBeenCalledTimes(3);
  });

  it("joins the run already preparing the goal's recordings", async () => {
    const exam = await listeningExamFixture();
    const goal = await examGoal(exam);
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-run" });

    await expect(listeningSetsWorkflow({ goalId: goal.id, wait: "later" })).resolves.toStrictEqual({
      status: "joined",
      voiced: 0,
    });

    expect(writeListeningSet).not.toHaveBeenCalled();
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
