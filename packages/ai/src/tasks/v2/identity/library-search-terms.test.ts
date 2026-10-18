import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type LibraryIdentitySubject } from "./library-identity-subject";
import { generateSearchTerms } from "./library-search-terms";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./library-search-terms.prompt.md", () => ({ default: "Write search terms." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function skill(title: string): LibraryIdentitySubject {
  return { item: { title }, kind: "skill", language: "en" };
}

const subjects = [
  skill("Read a balance sheet"),
  skill("Calculate a discount"),
  skill("Tip a waiter"),
];

describe(generateSearchTerms, () => {
  it("gives each subject the terms written for its number, whatever order the model answers in", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        items: [
          { item: 3, terms: ["gratuity"] },
          { item: 1, terms: ["assets liabilities"] },
          { item: 2, terms: ["percent off"] },
        ],
      }),
    );

    const { data, userPrompt } = await generateSearchTerms({ subjects });

    expect(data.subjects).toStrictEqual([
      { terms: ["assets liabilities"] },
      { terms: ["percent off"] },
      { terms: ["gratuity"] },
    ]);

    expect(userPrompt).toContain("ITEM 3:");
  });

  it("gives a subject the model skipped no terms, and ignores numbers nobody asked for", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        items: [
          { item: 1, terms: ["assets liabilities"] },
          { item: 1, terms: ["equity"] },
          { item: 4, terms: ["unrelated"] },
          { item: 3, terms: ["gratuity"] },
        ],
      }),
    );

    const { data } = await generateSearchTerms({ subjects });

    expect(data.subjects).toStrictEqual([
      { terms: ["assets liabilities", "equity"] },
      { terms: [] },
      { terms: ["gratuity"] },
    ]);
  });
});
