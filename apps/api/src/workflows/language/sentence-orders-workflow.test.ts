import { generateLanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import { prisma } from "@zoonk/db";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it, vi } from "vitest";
import { mockHookConflict } from "../../../mocks/workflow";
import { sentenceOrdersWorkflow } from "./sentence-orders-workflow";

const DAY_MS = 86_400_000;
const MAX_ATTEMPTS = 8;

type Written = Awaited<ReturnType<typeof generateLanguageSentenceOrders>>;

function writtenOrders(sentences: Written["data"]["sentences"]): Written {
  return {
    data: { sentences },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6.1-terra",
      promptVersion: "test-prompt",
      provider: "openai",
      requestedModel: "openai/gpt-6.1-terra",
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

const RENT_ORDERS = writtenOrders([
  {
    otherOrders: ["The rent is how much?", "How much is the deposit?"],
    otherTranslationOrders: ["O aluguel é quanto?"],
  },
]);

async function owedLessonFixture({ attempts = 0 }: { attempts?: number } = {}) {
  const { lesson, sentence } = await languageLessonFixture();
  const owedAt = new Date(Date.now() - DAY_MS);

  await prisma.lesson.update({
    data: { sentenceOrdersAttempts: attempts, updatedAt: owedAt },
    where: { id: lesson.id },
  });

  await prisma.lessonSentence.updateMany({
    data: { ordersOwedAt: owedAt },
    where: { lessonId: lesson.id },
  });

  return { lessonId: lesson.id, owedAt, sentenceId: sentence.id };
}

function readOrders({ lessonId, sentenceId }: { lessonId: string; sentenceId: string }) {
  return prisma.lessonSentence.findUniqueOrThrow({
    select: {
      lesson: { select: { sentenceOrdersAttempts: true, updatedAt: true } },
      ordersOwedAt: true,
      otherSentenceOrders: true,
      otherTranslationOrders: true,
    },
    where: { lessonId_sentenceId: { lessonId, sentenceId } },
  });
}

describe(sentenceOrdersWorkflow, () => {
  it("writes the orders a learner can build from the lesson's tiles and marks the lesson changed", async () => {
    const owed = await owedLessonFixture();
    vi.mocked(generateLanguageSentenceOrders).mockResolvedValue(RENT_ORDERS);

    await expect(sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] })).resolves.toStrictEqual({
      changed: 0,
      skipped: 0,
      written: 1,
    });

    const stored = await readOrders(owed);

    expect(stored).toMatchObject({
      ordersOwedAt: null,
      otherSentenceOrders: ["the rent? is How much"],
      otherTranslationOrders: ["o aluguel? é Quanto"],
    });

    expect(stored.lesson.updatedAt.getTime()).toBeGreaterThan(owed.owedAt.getTime());

    await expect(sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] })).resolves.toStrictEqual({
      changed: 0,
      skipped: 1,
      written: 0,
    });

    expect(generateLanguageSentenceOrders).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        learnerLanguage: "pt",
        sentences: [{ sentence: "How much is the rent?", translation: "Quanto é o aluguel?" }],
        targetLanguage: "en",
      }),
    );
  });

  it("leaves a lesson whose sentences changed during the call owing orders for its new sentences", async () => {
    const owed = await owedLessonFixture();

    vi.mocked(generateLanguageSentenceOrders).mockImplementation(async () => {
      await prisma.lessonSentence.updateMany({
        data: { translation: "Qual é o valor do aluguel?" },
        where: { lessonId: owed.lessonId },
      });

      return RENT_ORDERS;
    });

    await expect(sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] })).resolves.toStrictEqual({
      changed: 1,
      skipped: 0,
      written: 0,
    });

    await expect(readOrders(owed)).resolves.toMatchObject({
      lesson: { updatedAt: owed.owedAt },
      ordersOwedAt: owed.owedAt,
      otherSentenceOrders: [],
      otherTranslationOrders: [],
    });
  });

  it.each([0, 2])(
    "keeps repair debt when the model returns %i results for one sentence",
    async (count) => {
      const owed = await owedLessonFixture();

      vi.mocked(generateLanguageSentenceOrders).mockResolvedValue(
        writtenOrders(Array.from({ length: count }, () => RENT_ORDERS.data.sentences[0]!)),
      );

      await expect(sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] })).resolves.toStrictEqual({
        changed: 0,
        skipped: 0,
        written: 0,
      });

      await expect(readOrders(owed)).resolves.toMatchObject({
        lesson: { sentenceOrdersAttempts: 1, updatedAt: owed.owedAt },
        ordersOwedAt: owed.owedAt,
        otherSentenceOrders: [],
        otherTranslationOrders: [],
      });
    },
  );

  it("counts every try that reached the model and stops paying once the tries run out", async () => {
    const owed = await owedLessonFixture({ attempts: MAX_ATTEMPTS - 2 });
    vi.mocked(generateLanguageSentenceOrders).mockRejectedValue(new Error("Gateway unavailable"));

    await sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] });
    await sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] });

    vi.mocked(generateLanguageSentenceOrders).mockResolvedValue(RENT_ORDERS);

    await expect(sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] })).resolves.toStrictEqual({
      changed: 0,
      skipped: 1,
      written: 0,
    });

    expect(generateLanguageSentenceOrders).toHaveBeenCalledTimes(2);

    await expect(readOrders(owed)).resolves.toMatchObject({
      lesson: { sentenceOrdersAttempts: MAX_ATTEMPTS },
      ordersOwedAt: owed.owedAt,
    });
  });

  it("writes nothing while another run holds the lesson", async () => {
    const owed = await owedLessonFixture();
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-run" });

    await expect(sentenceOrdersWorkflow({ lessonIds: [owed.lessonId] })).resolves.toStrictEqual({
      changed: 0,
      skipped: 1,
      written: 0,
    });

    expect(generateLanguageSentenceOrders).not.toHaveBeenCalled();
  });
});
