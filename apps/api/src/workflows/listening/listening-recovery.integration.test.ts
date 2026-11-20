import { waitForSleep } from "@workflow/vitest";
import { speechModels } from "@zoonk/ai/speech-models";
import { listListeningPartsToPrepare } from "@zoonk/core/exams/listening/prepare";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  listeningContent,
  listeningGoalFixture,
  listeningSetFixture,
} from "@zoonk/testing/fixtures/listening";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { generateSpeech } from "ai";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { serveListeningAudio, speechResult } from "./_test-utils/speech";
import { listeningSetsWorkflow } from "./listening-sets-workflow";

vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get: vi.fn(),
  head: vi.fn(),
  put: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateSpeech: vi.fn(),
}));

async function examWithUnvoicedSet(content = listeningContent()) {
  const { blueprint, goal, listeningSkills } = await listeningGoalFixture();
  const exam = await listListeningPartsToPrepare({ goalId: goal.id });
  const [first, second] = exam?.parts ?? [];
  const [skill] = listeningSkills;
  assert(first && second && skill);
  const recording = await mediaAssetFixture({ kind: "audio" });

  const [pending, ready] = await Promise.all([
    listeningSetFixture({
      content: { ...content, task: first.task },
      examBlueprintId: blueprint.id,
    }),
    listeningSetFixture({
      content: { ...listeningContent(), task: second.task },
      examBlueprintId: blueprint.id,
      mediaAssetId: recording.id,
    }),
  ]);

  await Promise.all(
    [pending, ready].map((set) => itemFixture({ setId: set.id, skillId: skill.id })),
  );

  return { content, goalId: goal.id, setId: pending.id };
}

describe("listening recording recovery", { timeout: 60_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serveListeningAudio();
  });

  it("retries only the missing segment and reuses the other turns in a fresh run", async () => {
    const { content, goalId, setId } = await examWithUnvoicedSet();
    const missing = content.script.turns.at(-1)?.text;
    assert(missing);

    vi.mocked(generateSpeech).mockImplementation(async ({ text }) => {
      if (text === missing) {
        throw new Error("Speech unavailable");
      }

      return speechResult;
    });

    const failed = await start(listeningSetsWorkflow, [{ goalId, wait: "learner" }]);
    await expect(failed.returnValue).resolves.toStrictEqual({ status: "prepared", voiced: 0 });

    await expect(prisma.itemSet.findUniqueOrThrow({ where: { id: setId } })).resolves.toMatchObject(
      { mediaAssetId: null },
    );

    const calls = vi.mocked(generateSpeech).mock.calls.map(([input]) => input);

    expect(
      calls
        .filter(({ text }) => text === missing)
        .map(({ model }) => (typeof model === "string" ? model : model.modelId)),
    ).toStrictEqual([
      speechModels.geminiFlashLite,
      speechModels.geminiFlash,
      speechModels.geminiFlashLite,
      speechModels.geminiFlash,
    ]);

    expect(
      calls
        .filter(({ text }) => text !== missing)
        .map(({ text }) => text)
        .toSorted(),
    ).toStrictEqual(
      content.script.turns
        .slice(0, -1)
        .map(({ text }) => text)
        .toSorted(),
    );

    vi.mocked(generateSpeech).mockClear().mockResolvedValue(speechResult);

    const retry = await start(listeningSetsWorkflow, [{ goalId, wait: "learner" }]);
    await expect(retry.returnValue).resolves.toStrictEqual({ status: "prepared", voiced: 1 });

    expect(generateSpeech).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: missing }),
    );

    await expect(
      prisma.itemSet.findUniqueOrThrow({ include: { mediaAsset: true }, where: { id: setId } }),
    ).resolves.toMatchObject({ mediaAsset: { durationMs: 2200, mimeType: "audio/mpeg" } });
  });

  it("gives concurrent preparations of the same script one finished recording", async () => {
    const content = listeningContent();

    const [one, two] = await Promise.all([
      examWithUnvoicedSet(content),
      examWithUnvoicedSet(content),
    ]);

    const entered = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    vi.mocked(generateSpeech).mockImplementationOnce(async () => {
      entered.resolve(null);
      await release.promise;
      return speechResult;
    });

    const first = await start(listeningSetsWorkflow, [{ goalId: one.goalId, wait: "later" }]);
    await entered.promise;
    const second = await start(listeningSetsWorkflow, [{ goalId: two.goalId, wait: "learner" }]);
    const wait = await waitForSleep(second).finally(() => release.resolve(null));
    await expect(first.returnValue).resolves.toMatchObject({ voiced: 1 });
    await second.wakeUp({ correlationIds: [wait] });
    await expect(second.returnValue).resolves.toMatchObject({ voiced: 1 });

    expect(generateSpeech).toHaveBeenCalledTimes(content.script.turns.length);
    const sets = await prisma.itemSet.findMany({ where: { id: { in: [one.setId, two.setId] } } });

    expect(sets.map(({ mediaAssetId }) => mediaAssetId)).toStrictEqual([
      expect.any(String),
      sets[0]?.mediaAssetId,
    ]);
  });
});
