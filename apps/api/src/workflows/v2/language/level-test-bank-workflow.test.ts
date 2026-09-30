import { generateLevelTestBank } from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { levelTestBankWorkflow } from "./level-test-bank-workflow";

// Writing the bank is a paid model call.
vi.mock("@zoonk/ai/tasks/v2/language/level-test-bank", () => ({ generateLevelTestBank: vi.fn() }));

const TEST_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

type Written = Awaited<ReturnType<typeof generateLevelTestBank>>;

function bankFrom(passage: string): Written {
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
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "anthropic/claude-opus-5.5",
      promptVersion: "test-prompt",
      provider: "anthropic",
      requestedModel: "anthropic/claude-opus-5.5",
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

/** A language pair no other test uses: the learner language is a made-up code. */
function freshPair() {
  return { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };
}

function streamedSteps() {
  return getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`);
}

describe(levelTestBankWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBank).mockReset();
  });

  it("writes the pair's questions once, saying so on its stream", async () => {
    const pair = freshPair();
    vi.mocked(generateLevelTestBank).mockResolvedValue(bankFrom("Bank"));

    await expect(
      levelTestBankWorkflow({ analytics: { distinctId: "learner-id", goalId: "goal-id" }, pair }),
    ).resolves.toStrictEqual({ status: "written" });

    expect(vi.mocked(createHook)).toHaveBeenCalledWith({
      token: `level-test-bank:${pair.language}:ja`,
    });

    expect(generateLevelTestBank).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: expect.objectContaining({ distinctId: "learner-id", goalId: "goal-id" }),
        learnerLanguage: pair.language,
        targetLanguage: "ja",
      }),
    );

    expect(streamedSteps()).toStrictEqual([
      "writeLevelTestBank:started",
      "levelTestBankReady:completed",
    ]);

    // A later start finds the questions written and ends at once.
    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "ready" });
    expect(generateLevelTestBank).toHaveBeenCalledOnce();
  });

  it("joins the run already writing the pair", async () => {
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "writing-run" });

    await expect(levelTestBankWorkflow({ pair: freshPair() })).resolves.toStrictEqual({
      status: "joined",
    });

    expect(generateLevelTestBank).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "writing-run", status: "started", step: "joinLevelTestBank" },
    ]);
  });

  it("waits for another writer's questions instead of writing them twice", async () => {
    const pair = freshPair();

    // A run that started before this workflow existed holds a live claim on the pair.
    await prisma.languageLevelTest.create({
      data: {
        ...pair,
        content: {},
        generatedAt: new Date(),
        model: "",
        promptVersion: "",
        runId: "other",
      },
    });

    vi.mocked(sleep).mockImplementationOnce(async () => {
      const { data, provenance } = bankFrom("Other");

      await prisma.languageLevelTest.updateMany({
        data: {
          content: {
            questions: data.questions.map((question, index) => ({ ...question, id: `q${index}` })),
            speaking: data.speaking,
          },
          model: provenance.model,
        },
        where: pair,
      });
    });

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "ready" });

    expect(generateLevelTestBank).not.toHaveBeenCalled();
    expect(streamedSteps().at(-1)).toBe("levelTestBankReady:completed");
  });

  it("reports a writer that failed, giving the pair's claim up so the level test can start it again", async () => {
    const pair = freshPair();
    vi.mocked(generateLevelTestBank).mockRejectedValue(new Error("Provider down"));

    await expect(levelTestBankWorkflow({ pair })).rejects.toThrow("Provider down");

    expect(getStreamedEvents().at(-1)).toMatchObject({
      reason: "aiGenerationFailed",
      status: "error",
      step: "workflowError",
    });

    const row = await prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });
    expect(row.generatedAt.getTime()).toBe(0);
  });
});
