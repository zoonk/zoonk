import { checkSentenceOrders } from "@zoonk/ai/tasks/language/check-sentence-orders";
import { describe, expect, it, vi } from "vitest";
import { checkOrderCandidates, toOrderCandidates } from "./sentence-orders";

const SENTENCE = {
  sentence: "Plants grow in many places",
  translation: "Plants grow in many places",
};

function mockReview(keep: boolean) {
  vi.mocked(checkSentenceOrders).mockResolvedValue({
    data: {
      sentences: [{ sentenceCandidates: [{ candidate: "In many places plants grow", keep }] }],
    },
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

describe(checkOrderCandidates, () => {
  it.each([
    ["duplicate", ["In many places plants grow", "In many places plants grow"]],
    ["reordered", ["Plants in many places grow", "In many places plants grow"]],
    ["unexpected", ["In many places plants grow", "Many plants grow in places"]],
  ])(
    "rejects %s candidate echoes instead of silently dropping an unreviewed order",
    async (_name, echoes) => {
      const candidates = [
        {
          otherOrders: ["In many places plants grow", "Plants in many places grow"],
          otherTranslationOrders: [],
        },
      ];

      vi.mocked(checkSentenceOrders).mockResolvedValue({
        data: {
          sentences: [
            { sentenceCandidates: echoes.map((candidate) => ({ candidate, keep: true })) },
          ],
        },
        provenance: {} as never,
        systemPrompt: "",
        usage: {} as never,
        userPrompt: "",
      });

      await expect(
        checkOrderCandidates({
          candidates,
          learnerLanguage: "en",
          sentences: [SENTENCE],
          targetLanguage: "en",
        }),
      ).rejects.toThrow("The review must judge every candidate, in order.");
    },
  );

  it("in the learner's own language, reviews the sentence's orders once and gives them to the translation", async () => {
    const candidates = toOrderCandidates({
      generated: { sentences: [{ otherOrders: ["In many places plants grow"] }] },
      sameLanguage: true,
      sentences: [SENTENCE],
    });

    mockReview(true);

    await expect(
      checkOrderCandidates({
        candidates,
        learnerLanguage: "en",
        sentences: [SENTENCE],
        targetLanguage: "en",
      }),
    ).resolves.toStrictEqual([
      {
        otherOrders: ["in many places Plants grow"],
        otherTranslationOrders: ["in many places Plants grow"],
      },
    ]);

    expect(vi.mocked(checkSentenceOrders).mock.calls[0]?.[0].sentences).toStrictEqual([
      {
        ...SENTENCE,
        sentenceCandidates: ["In many places plants grow"],
        translationCandidates: [],
      },
    ]);
  });
});
