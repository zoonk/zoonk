import { checkSentenceOrders } from "@zoonk/ai/tasks/language/check-sentence-orders";
import { describe, expect, it, vi } from "vitest";
import { checkOrderCandidates, toOrderCandidates } from "./sentence-orders";

const SENTENCE = {
  sentence: "Plants grow in many places",
  translation: "Plants grow in many places",
};

type Reviewed = Awaited<ReturnType<typeof checkSentenceOrders>>["data"]["sentences"];

function mockReview(sentences: Reviewed) {
  vi.mocked(checkSentenceOrders).mockResolvedValue({
    data: { sentences },
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

describe(checkOrderCandidates, () => {
  it("keeps the original candidate at each approved position without an echoed text", async () => {
    mockReview([{ sentenceKeep: [false, true], translationKeep: [true, false] }]);

    await expect(
      checkOrderCandidates({
        candidates: [
          {
            otherOrders: ['"In many places plants grow"', "Plants  in many places grow"],
            otherTranslationOrders: [
              '"Em muitos lugares plantas crescem"',
              "Plantas em muitos lugares crescem",
            ],
          },
        ],
        learnerLanguage: "pt",
        sentences: [{ ...SENTENCE, translation: "Plantas crescem em muitos lugares" }],
        targetLanguage: "en",
      }),
    ).resolves.toStrictEqual([
      {
        otherOrders: ["Plants in many places grow"],
        otherTranslationOrders: ["em muitos lugares Plantas crescem"],
      },
    ]);
  });

  it.each<[string, Reviewed, string]>([
    ["missing sentence", [], "one result per requested sentence"],
    [
      "extra sentence",
      [{ sentenceKeep: [true, false] }, { sentenceKeep: [] }],
      "one result per requested sentence",
    ],
    [
      "missing sentence verdict",
      [{ sentenceKeep: [true], translationKeep: [true, false] }],
      "judge every candidate",
    ],
    [
      "extra sentence verdict",
      [{ sentenceKeep: [true, false, true], translationKeep: [true, false] }],
      "judge every candidate",
    ],
    [
      "missing translation verdict",
      [{ sentenceKeep: [true, false], translationKeep: [true] }],
      "judge every candidate",
    ],
    [
      "extra translation verdict",
      [{ sentenceKeep: [true, false], translationKeep: [true, false, true] }],
      "judge every candidate",
    ],
  ])("rejects a %s", async (_name, verdicts, error) => {
    mockReview(verdicts);

    await expect(
      checkOrderCandidates({
        candidates: [
          {
            otherOrders: ["In many places plants grow", "Plants in many places grow"],
            otherTranslationOrders: [
              "Em muitos lugares plantas crescem",
              "Plantas em muitos lugares crescem",
            ],
          },
        ],
        learnerLanguage: "pt",
        sentences: [{ ...SENTENCE, translation: "Plantas crescem em muitos lugares" }],
        targetLanguage: "en",
      }),
    ).rejects.toThrow(error);
  });

  it("in the learner's own language, reviews the sentence's orders once and gives them to the translation", async () => {
    const candidates = toOrderCandidates({
      generated: { sentences: [{ otherOrders: ["In many places plants grow"] }] },
      sameLanguage: true,
      sentences: [SENTENCE],
    });

    mockReview([{ sentenceKeep: [true] }]);

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
