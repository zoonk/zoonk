import { checkSentenceOrders } from "@zoonk/ai/tasks/language/check-sentence-orders";
import { generateLanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import { prisma } from "@zoonk/db";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it, vi } from "vitest";
import { mockHookConflict } from "../../../mocks/workflow";
import { taskResult } from "../_test-utils/recorded-outputs";
import { sentenceOrdersWorkflow } from "./sentence-orders-workflow";

const DAY_MS = 86_400_000;
const MAX_ATTEMPTS = 8;

type Generated = Awaited<ReturnType<typeof generateLanguageSentenceOrders>>["data"]["sentences"];
type Reviewed = Awaited<ReturnType<typeof checkSentenceOrders>>["data"]["sentences"];

function mockGenerated(sentences: Generated) {
  vi.mocked(generateLanguageSentenceOrders).mockResolvedValue(taskResult({ sentences }));
}

function mockReviewed(sentences: Reviewed) {
  vi.mocked(checkSentenceOrders).mockResolvedValue(taskResult({ sentences }));
}

const RENT_CANDIDATES: Generated = [
  {
    otherOrders: ["The rent is how much?", "How much is the deposit?"],
    otherTranslationOrders: ["O aluguel é quanto?", "É quanto o aluguel?"],
  },
];

const RENT_REVIEW: Reviewed = [
  {
    sentenceCandidates: [{ candidate: "The rent is how much?", keep: false }],
    translationCandidates: [
      { candidate: "O aluguel é quanto?", keep: true },
      { candidate: "É quanto o aluguel?", keep: false },
    ],
  },
];

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

function writeOrdersOf(lessonId: string) {
  return sentenceOrdersWorkflow({ lessonIds: [lessonId], wait: "later" });
}

describe(sentenceOrdersWorkflow, () => {
  it("saves the buildable candidates the review keeps, as the lesson's tiles, and marks the lesson changed", async () => {
    const owed = await owedLessonFixture();
    mockGenerated(RENT_CANDIDATES);
    mockReviewed(RENT_REVIEW);

    await expect(writeOrdersOf(owed.lessonId)).resolves.toStrictEqual({
      changed: 0,
      skipped: 0,
      written: 1,
    });

    const stored = await readOrders(owed);

    expect(stored).toMatchObject({
      ordersOwedAt: null,
      otherSentenceOrders: [],
      otherTranslationOrders: ["o aluguel? é Quanto"],
    });

    expect(stored.lesson.updatedAt.getTime()).toBeGreaterThan(owed.owedAt.getTime());

    expect(generateLanguageSentenceOrders).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        learnerLanguage: "pt",
        sentences: [expect.objectContaining({ sentence: "How much is the rent?" })],
        serviceTier: "flex",
        targetLanguage: "en",
      }),
    );

    expect(checkSentenceOrders).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        sentences: [
          {
            sentence: "How much is the rent?",
            sentenceCandidates: ["The rent is how much?"],
            translation: "Quanto é o aluguel?",
            translationCandidates: ["O aluguel é quanto?", "É quanto o aluguel?"],
          },
        ],
      }),
    );

    await expect(writeOrdersOf(owed.lessonId)).resolves.toStrictEqual({
      changed: 0,
      skipped: 1,
      written: 0,
    });
  });

  it("saves no orders without a review when nothing generated can be built from the tiles", async () => {
    const owed = await owedLessonFixture();
    mockGenerated([{ otherOrders: ["How much is the deposit?"], otherTranslationOrders: [] }]);

    await expect(writeOrdersOf(owed.lessonId)).resolves.toMatchObject({ written: 1 });

    await expect(readOrders(owed)).resolves.toMatchObject({
      ordersOwedAt: null,
      otherSentenceOrders: [],
      otherTranslationOrders: [],
    });

    expect(checkSentenceOrders).not.toHaveBeenCalled();
  });

  it("leaves a lesson whose sentences changed during the review owing orders for its new sentences", async () => {
    const owed = await owedLessonFixture();
    mockGenerated(RENT_CANDIDATES);

    vi.mocked(checkSentenceOrders).mockImplementation(async () => {
      await prisma.lessonSentence.updateMany({
        data: { translation: "Qual é o valor do aluguel?" },
        where: { lessonId: owed.lessonId },
      });

      return taskResult({ sentences: RENT_REVIEW });
    });

    await expect(writeOrdersOf(owed.lessonId)).resolves.toStrictEqual({
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

  it.each([
    ["the generator returns no result for the sentence", [], RENT_REVIEW],
    [
      "the generator returns two results for one sentence",
      [...RENT_CANDIDATES, ...RENT_CANDIDATES],
      RENT_REVIEW,
    ],
    [
      "the review skips a candidate",
      RENT_CANDIDATES,
      [
        {
          ...RENT_REVIEW[0]!,
          translationCandidates: RENT_REVIEW[0]!.translationCandidates?.slice(1),
        },
      ],
    ],
  ])("keeps the lesson owing its orders when %s", async (_case, generated, reviewed) => {
    const owed = await owedLessonFixture();
    mockGenerated(generated);
    mockReviewed(reviewed);

    await expect(writeOrdersOf(owed.lessonId)).resolves.toStrictEqual({
      changed: 0,
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

  it("counts every try that reached a model and stops paying once the tries run out", async () => {
    const owed = await owedLessonFixture({ attempts: MAX_ATTEMPTS - 3 });
    mockGenerated(RENT_CANDIDATES);
    vi.mocked(checkSentenceOrders).mockRejectedValue(new Error("Gateway unavailable"));

    await writeOrdersOf(owed.lessonId);

    mockReviewed(RENT_REVIEW);

    await expect(writeOrdersOf(owed.lessonId)).resolves.toMatchObject({ written: 0 });

    expect(generateLanguageSentenceOrders).toHaveBeenCalledTimes(2);
    expect(checkSentenceOrders).toHaveBeenCalledOnce();

    await expect(readOrders(owed)).resolves.toMatchObject({
      lesson: { sentenceOrdersAttempts: MAX_ATTEMPTS },
      ordersOwedAt: owed.owedAt,
    });
  });

  it("writes nothing while another run holds the lesson", async () => {
    const owed = await owedLessonFixture();
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-run" });

    await expect(writeOrdersOf(owed.lessonId)).resolves.toStrictEqual({
      changed: 0,
      skipped: 1,
      written: 0,
    });

    expect(generateLanguageSentenceOrders).not.toHaveBeenCalled();
  });
});
