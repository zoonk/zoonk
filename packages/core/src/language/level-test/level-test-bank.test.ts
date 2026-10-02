import { generateLevelTestBank } from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { getLanguageLevelTest } from "./get-language-level-test";
import { writeLevelTestBank } from "./write-level-test-bank";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// Writing the bank is a paid model call.
vi.mock("@zoonk/ai/tasks/v2/language/level-test-bank", () => ({ generateLevelTestBank: vi.fn() }));

const TEST_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

type Written = Awaited<ReturnType<typeof generateLevelTestBank>>;

function bankFrom(passage: string): Written {
  return {
    data: {
      questions: TEST_LEVELS.flatMap((level) =>
        (["reading", "listening"] as const).flatMap((skill) =>
          [0, 1].map(() => ({
            answerIndex: 0,
            level,
            options: ["a", "b", "c", "d"],
            passage: `${passage} ${level}`,
            question: "O que diz?",
            skill,
          })),
        ),
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

/** A writer run the test finishes when it chooses, as `resolve` with a bank from `passage`. */
function pendingWriter() {
  const { promise, resolve } = Promise.withResolvers<Written>();
  vi.mocked(generateLevelTestBank).mockReturnValueOnce(promise);
  return { finish: (passage: string) => resolve(bankFrom(passage)) };
}

/** A language pair no other test uses: the learner language is a made-up code. */
function freshPair() {
  return { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };
}

/** A signed-in learner whose language goal is for a pair no other test writes. */
async function learnerOfFreshPair() {
  const pair = freshPair();
  const setup = await languageGoalFixture();

  await prisma.goal.update({ data: pair, where: { id: setup.goal.id } });
  mockSession(setup.user.id);

  return { goalId: setup.goal.id, pair };
}

function findRow(pair: { language: string; targetLanguage: string }) {
  return prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });
}

describe("the level test's question bank", () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBank).mockClear();
  });

  it("is never written by showing the test, which says since when a run has been writing it", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    await expect(getLanguageLevelTest(goalId)).resolves.toStrictEqual({
      status: "ready",
      test: { expectedSeconds: 120, startedAt: null, status: "preparing" },
    });

    await expect(prisma.languageLevelTest.count({ where: pair })).resolves.toBe(0);

    const writer = pendingWriter();
    const writing = writeLevelTestBank({ pair });

    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(1);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: expect.any(String), status: "preparing" },
    });

    writer.finish("Bank");
    await expect(writing).resolves.toStrictEqual({ status: "written" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { next: { kind: "question" }, status: "ready" },
    });

    await expect(findRow(pair)).resolves.toMatchObject({
      model: "anthropic/claude-opus-5.5",
      promptVersion: "test-prompt",
    });

    expect(generateLevelTestBank).toHaveBeenCalledOnce();
  });

  it("isn't started by an answer", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    await expect(
      answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: "reading-A2-0" } }),
    ).resolves.toStrictEqual({ status: "notReady" });

    await expect(prisma.languageLevelTest.count({ where: pair })).resolves.toBe(0);
  });

  it("reads a run that went quiet or failed as nothing writing it, so the app starts one", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    vi.mocked(generateLevelTestBank).mockRejectedValueOnce(new Error("Provider down"));
    await expect(writeLevelTestBank({ pair })).rejects.toThrow("Provider down");

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: null, status: "preparing" },
    });

    const quiet = pendingWriter();
    void writeLevelTestBank({ pair });
    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(2);

    await prisma.languageLevelTest.updateMany({
      // Longer ago than any run that writes it may take.
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: pair,
    });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: null, status: "preparing" },
    });

    quiet.finish("Late");
  });
});

describe("writing a pair's question bank ahead", () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBank).mockClear();
  });

  it("writes it before the first learner opens the test, which then starts at once", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom("Ahead"));

    await expect(
      writeLevelTestBank({ analytics: { distinctId: "learner-id", goalId }, pair }),
    ).resolves.toStrictEqual({ status: "written" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { next: { question: { passage: "Ahead A2" } }, status: "ready" },
    });

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });

    expect(generateLevelTestBank).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: { contentScope: "shared", distinctId: "learner-id", goalId },
        learnerLanguage: pair.language,
        targetLanguage: pair.targetLanguage,
      }),
    );
  });

  it("leaves the pair to the run already writing it", async () => {
    const pair = freshPair();
    const writer = pendingWriter();
    const first = writeLevelTestBank({ pair });

    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(1);
    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "running" });

    writer.finish("First");
    await expect(first).resolves.toStrictEqual({ status: "written" });

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });
    expect(generateLevelTestBank).toHaveBeenCalledOnce();
  });

  it("gives its claim up when the writer fails, so a retry writes it", async () => {
    const pair = freshPair();
    vi.mocked(generateLevelTestBank).mockRejectedValueOnce(new Error("Provider down"));

    await expect(writeLevelTestBank({ pair })).rejects.toThrow("Provider down");

    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom("Retry"));

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });
  });

  it("drops a late write when a newer run took its claim over", async () => {
    const pair = freshPair();
    const late = pendingWriter();
    const first = writeLevelTestBank({ pair });

    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(1);

    await prisma.languageLevelTest.updateMany({
      // Longer ago than any run that writes it may take.
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: pair,
    });

    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom("Current"));
    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });

    late.finish("Late");
    await expect(first).resolves.toStrictEqual({ status: "lost" });

    const row = await findRow(pair);
    expect(JSON.stringify(row.content)).toContain("Current A1");
    expect(JSON.stringify(row.content)).not.toContain("Late");
  });
});
