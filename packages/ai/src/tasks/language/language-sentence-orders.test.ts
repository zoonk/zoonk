import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateLanguageSentenceOrders } from "./language-sentence-orders";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./language-sentence-orders.prompt.md", () => ({
  default:
    "Orders.\n{{#bilingual}}\nTranslation orders.\n{{/bilingual}}\n{{#sameLanguage}}\nOne language.\n{{/sameLanguage}}\n",
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const SENTENCES = [{ sentence: "Plants need water", translation: "Plants need water" }];

describe(generateLanguageSentenceOrders, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ sentences: [] }));
  });

  it("in the learner's own language, asks only for the sentence's orders", async () => {
    const sameLanguage = await generateLanguageSentenceOrders({
      learnerLanguage: "en",
      sentences: SENTENCES,
      targetLanguage: "en",
    });

    const bilingual = await generateLanguageSentenceOrders({
      learnerLanguage: "pt",
      sentences: [{ sentence: "Plants need water", translation: "Plantas precisam de água" }],
      targetLanguage: "en",
    });

    expect(sameLanguage.systemPrompt).toBe("Orders.\nOne language.\n");
    expect(sameLanguage.userPrompt).not.toContain("translation");
    expect(sameLanguage.userPrompt).not.toContain("LEARNER_LANGUAGE");
    expect(bilingual.systemPrompt).toBe("Orders.\nTranslation orders.\n");
    expect(bilingual.userPrompt).toContain("translation: Plantas precisam de água");
  });
});
