import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { checkSentenceOrders } from "./check-sentence-orders";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./check-sentence-orders.prompt.md", () => ({
  default:
    "Review.\n{{#bilingual}}\nTranslations too.\n{{/bilingual}}\n{{#sameLanguage}}\nOne language.\n{{/sameLanguage}}\n",
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

describe(checkSentenceOrders, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ sentences: [] }));
  });

  it("in the learner's own language, reviews only the sentence's candidates", async () => {
    const sentence = {
      sentence: "Plants grow in many places",
      sentenceCandidates: ["In many places plants grow"],
      translation: "Plants grow in many places",
      translationCandidates: ["In many places plants grow"],
    };

    const sameLanguage = await checkSentenceOrders({
      learnerLanguage: "en",
      sentences: [sentence],
      targetLanguage: "en",
    });

    const bilingual = await checkSentenceOrders({
      learnerLanguage: "pt",
      sentences: [
        {
          ...sentence,
          translation: "Plantas crescem em muitos lugares",
          translationCandidates: ["Em muitos lugares plantas crescem"],
        },
      ],
      targetLanguage: "en",
    });

    expect(sameLanguage.systemPrompt).toBe("Review.\nOne language.\n");
    expect(sameLanguage.userPrompt).toContain('sentenceCandidates: ["In many places plants grow"]');
    expect(sameLanguage.userPrompt).not.toContain("translation");
    expect(bilingual.systemPrompt).toBe("Review.\nTranslations too.\n");

    expect(bilingual.userPrompt).toContain(
      'translationCandidates: ["Em muitos lugares plantas crescem"]',
    );
  });
});
