import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateLevelTestBank } from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { LEVEL_TEST_BANK_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";
import { type Run, start } from "workflow/api";
import { levelTestBankWorkflow } from "./level-test-bank-workflow";

vi.mock("@zoonk/ai/tasks/audio", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLanguageAudio: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/language/level-test-bank", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLevelTestBank: vi.fn(),
}));

// Steps upload to Vercel Blob, which has no store in tests.
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  put: vi.fn(async (pathname: string) => ({ pathname, url: `https://blob.test/${pathname}` })),
}));

const TEST_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "anthropic/claude-opus-5.5",
  promptVersion: "test-prompt",
  provider: "anthropic",
  requestedModel: "anthropic/claude-opus-5.5",
  runId: "run-test",
  usage: {},
};

function bankOf(passage: string): Awaited<ReturnType<typeof generateLevelTestBank>> {
  return {
    data: {
      questions: TEST_LEVELS.flatMap((level) =>
        (["reading", "listening"] as const).map((skill) => ({
          answerIndex: 0,
          level,
          options: ["a", "b", "c", "d"],
          passage: `${passage} ${level}`,
          question: "O que diz?",
          skill,
        })),
      ),
      speaking: TEST_LEVELS.map((level) => ({
        level,
        sentence: `Say ${level}`,
        translation: "Diga",
      })),
    },
    provenance: PROVENANCE,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

function voiced(): Awaited<ReturnType<typeof generateLanguageAudio>> {
  return {
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 2400,
      format: "mp3",
      provenance: PROVENANCE,
    },
    error: null,
  };
}

const STREAM_END_MS = 5000;
const OWNER_WRITING_MS = 30_000;

/** Null when the stream is still open a few seconds after the run ended. */
async function readStreamToEnd(run: Run<unknown>): Promise<string | null> {
  let text = "";

  const sink = new WritableStream<string>({
    write: (chunk) => {
      text += chunk;
    },
  });

  const ended = await run
    .getReadable<string>()
    .pipeTo(sink, { signal: AbortSignal.timeout(STREAM_END_MS) })
    .then(
      () => true,
      () => false,
    );

  return ended ? text : null;
}

function uniquePair() {
  return { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };
}

describe(levelTestBankWorkflow, () => {
  it("ends the run's stream once the bank is ready", async () => {
    vi.mocked(generateLevelTestBank).mockResolvedValue(bankOf(crypto.randomUUID()));
    vi.mocked(generateLanguageAudio).mockResolvedValue(voiced());

    const run = await start(levelTestBankWorkflow, [{ pair: uniquePair() }]);

    await expect(run.returnValue).resolves.toStrictEqual({ status: "written" });

    await expect(readStreamToEnd(run)).resolves.toStrictEqual(
      expect.stringContaining(`"step":"${LEVEL_TEST_BANK_READY_STEP}"`),
    );
  });

  it("ends the run's stream when the bank can't be written", async () => {
    vi.mocked(generateLevelTestBank).mockRejectedValue(new FatalError("No model answered"));

    const run = await start(levelTestBankWorkflow, [{ pair: uniquePair() }]);

    await expect(run.returnValue).rejects.toThrow("No model answered");

    await expect(readStreamToEnd(run)).resolves.toStrictEqual(
      expect.stringContaining(`"step":"${WORKFLOW_ERROR_STEP}"`),
    );
  });

  it("ends a joining run's stream once it hands over to the run writing the bank", async () => {
    const writing = Promise.withResolvers<null>();
    const pair = uniquePair();

    vi.mocked(generateLevelTestBank).mockReset();
    vi.mocked(generateLanguageAudio).mockResolvedValue(voiced());

    vi.mocked(generateLevelTestBank).mockImplementation(async () => {
      await writing.promise;
      return bankOf(crypto.randomUUID());
    });

    const owner = await start(levelTestBankWorkflow, [{ pair }]);

    await vi.waitFor(() => expect(generateLevelTestBank).toHaveBeenCalledOnce(), {
      timeout: OWNER_WRITING_MS,
    });

    const joining = await start(levelTestBankWorkflow, [{ pair }]);

    await expect(joining.returnValue).resolves.toStrictEqual({ status: "joined" });

    await expect(readStreamToEnd(joining)).resolves.toStrictEqual(
      expect.stringContaining(`"step":"joinLevelTestBank"`),
    );

    writing.resolve(null);
    await expect(owner.returnValue).resolves.toStrictEqual({ status: "written" });
  });

  it("retries a failed clip alone and finishes with its questions ready when one never voices", async () => {
    const passage = crypto.randomUUID();
    const pair = { language: `x${passage.slice(0, 8)}`, targetLanguage: "ja" };
    const flaky = `${passage} A2`;
    const broken = `${passage} B1`;
    const failed = { data: null, error: new Error("Voice unavailable") };
    const tries = new Map<string, number>();

    vi.mocked(generateLevelTestBank).mockResolvedValue(bankOf(passage));

    vi.mocked(generateLanguageAudio).mockImplementation(async ({ text }) => {
      const attempt = (tries.get(text) ?? 0) + 1;
      tries.set(text, attempt);

      return text === broken || (text === flaky && attempt === 1) ? failed : voiced();
    });

    const run = await start(levelTestBankWorkflow, [{ pair }]);

    await expect(run.returnValue).resolves.toStrictEqual({ status: "written" });
    expect(generateLevelTestBank).toHaveBeenCalledOnce();

    expect(Object.fromEntries(tries)).toStrictEqual({
      [`${passage} A1`]: 1,
      [`${passage} A2`]: 2,
      [`${passage} B1`]: 4,
      [`${passage} B2`]: 1,
      [`${passage} C1`]: 1,
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
    ]);
  });
});
