import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateLevelTestBankPart } from "@zoonk/ai/tasks/language/level-test-bank";
import { writtenLevel, writtenPart } from "@zoonk/ai/tasks/language/level-test-bank-fixture";
import { LEVEL_TEST_BANK_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";
import { start } from "workflow/api";
import { readStreamToEnd } from "../_test-utils/read-run-stream";
import { levelTestBankWorkflow } from "./level-test-bank-workflow";

vi.mock("@zoonk/ai/tasks/audio", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLanguageAudio: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/language/check-level-test-questions", async (importOriginal) => {
  const { checkLikeTheKeys } = await import("@zoonk/ai/tasks/language/level-test-bank-fixture");
  return { ...(await importOriginal<object>()), checkLevelTestQuestions: vi.fn(checkLikeTheKeys) };
});

vi.mock("@zoonk/ai/tasks/language/level-test-bank", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLevelTestBankPart: vi.fn(),
}));

// Steps upload to Vercel Blob, which has no store in tests.
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  put: vi.fn(async (pathname: string) => ({ pathname, url: `https://blob.test/${pathname}` })),
}));

function mockWriter(passage: string) {
  vi.mocked(generateLevelTestBankPart).mockImplementation(async ({ level, part }) =>
    writtenPart({ level, part, passage }),
  );
}

function voiced(): Awaited<ReturnType<typeof generateLanguageAudio>> {
  return {
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 2400,
      format: "mp3",
      provenance: writtenLevel({ level: "A1", passage: "voice" }).provenance,
    },
    error: null,
  };
}

function uniquePair() {
  return { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };
}

describe(levelTestBankWorkflow, () => {
  it("retries only the failed writing call and ends the stream once the bank is ready", async () => {
    const passage = crypto.randomUUID();
    const attempts = new Map<string, number>();

    vi.mocked(generateLevelTestBankPart).mockImplementation(async ({ level, part }) => {
      const key =
        part === "confirmations"
          ? `${level}-confirmations`
          : [level, part.skill, part.offset].join("-");

      const attempt = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, attempt);

      if (key === "B2-listening-4" && attempt === 1) {
        throw new Error("Provider temporarily unavailable");
      }

      return writtenPart({ level, part, passage });
    });

    vi.mocked(generateLanguageAudio).mockResolvedValue(voiced());

    const run = await start(levelTestBankWorkflow, [{ pair: uniquePair() }]);

    await expect(run.returnValue).resolves.toStrictEqual({ status: "written" });

    expect(attempts.size).toBe(42);
    expect([...attempts].filter(([, count]) => count !== 1)).toStrictEqual([["B2-listening-4", 2]]);

    await expect(readStreamToEnd(run)).resolves.toStrictEqual(
      expect.stringContaining(`"step":"${LEVEL_TEST_BANK_READY_STEP}"`),
    );
  });

  it("ends the run's stream when the bank can't be written", async () => {
    vi.mocked(generateLevelTestBankPart).mockRejectedValue(new FatalError("No model answered"));

    const run = await start(levelTestBankWorkflow, [{ pair: uniquePair() }]);

    await expect(run.returnValue).rejects.toThrow("No model answered");

    await expect(readStreamToEnd(run)).resolves.toStrictEqual(
      expect.stringContaining(`"step":"${WORKFLOW_ERROR_STEP}"`),
    );
  });

  it("retries a failed clip alone and finishes with its questions ready when one never voices", async () => {
    const passage = crypto.randomUUID();
    const pair = { language: `x${passage.slice(0, 8)}`, targetLanguage: "ja" };
    const flaky = `${passage} A2`;
    const broken = `${passage} B1`;
    const failed = { data: null, error: new Error("Voice unavailable") };
    const tries = new Map<string, number>();

    mockWriter(passage);

    vi.mocked(generateLanguageAudio).mockImplementation(async ({ text }) => {
      const attempt = (tries.get(text) ?? 0) + 1;
      tries.set(text, attempt);

      return text === broken || (text === flaky && attempt === 1) ? failed : voiced();
    });

    const run = await start(levelTestBankWorkflow, [{ pair }]);

    await expect(run.returnValue).resolves.toStrictEqual({ status: "written" });
    expect(generateLevelTestBankPart).toHaveBeenCalledTimes(42);

    expect(Object.fromEntries(tries)).toStrictEqual({
      [`${passage} A1`]: 1,
      [`${passage} A2`]: 2,
      [`${passage} B1`]: 4,
      [`${passage} B2`]: 1,
      [`${passage} C1`]: 1,
      [`${passage} C2`]: 1,
    });

    const clips = await prisma.mediaAsset.findMany({
      orderBy: { prompt: "asc" },
      select: { prompt: true },
      where: { prompt: { startsWith: passage } },
    });

    expect(clips.map((clip) => clip.prompt)).toStrictEqual([
      `${passage} A1`,
      `${passage} A2`,
      `${passage} B2`,
      `${passage} C1`,
      `${passage} C2`,
    ]);
  });
});
