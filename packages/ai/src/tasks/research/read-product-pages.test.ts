import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerEmptyOnce } from "../_test-utils/answer-once-with";
import { readGatewayOptions } from "../_test-utils/gateway-options";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { readProductPages } from "./read-product-pages";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./read-product-pages.prompt.md", () => ({
  default:
    "Read.\n{{#new}}\nBrand and product.\n{{/new}}\n{{#known}}\nReleases only.\n{{/known}}\n{{#release}}\nThe learner's release.\n{{/release}}\n",
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const HINTS = { brand: "Lumen Works", name: "Orbit Notes", release: null };

const PAGE = {
  text: "Orbit Notes 5 shipped on October 21st, 2025.",
  title: "Releases",
  url: "https://lumen.example/releases",
};

describe(readProductPages, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ releases: [] }));
  });

  it("reads only releases for a known product, with no brand or product claims", async () => {
    const { data, systemPrompt } = await readProductPages({
      hints: HINTS,
      known: true,
      pages: [PAGE],
    });

    expect(systemPrompt).toBe("Read.\nReleases only.\n");
    expect(data).toStrictEqual({ brand: null, learnerRelease: null, product: null, releases: [] });
  });

  it("asks for the learner's release only when they named one", async () => {
    const named = await readProductPages({
      hints: { ...HINTS, release: "Orbit Notes 5" },
      pages: [PAGE],
    });

    expect(named.systemPrompt).toBe("Read.\nBrand and product.\nThe learner's release.\n");
  });

  it("sends each page as a numbered document", async () => {
    await readProductPages({ hints: HINTS, pages: [PAGE] });

    const prompt = JSON.stringify(vi.mocked(generateText).mock.lastCall?.[0].prompt);

    expect(prompt).toContain("DOCUMENT 1: Releases (https://lumen.example/releases)");
  });

  it("keeps the learner's words away from providers that train, reading only stored names freely", async () => {
    const analytics = { contentScope: "shared" as const };
    const named = { ...HINTS, release: "Orbit Notes 5" };
    const options: unknown[] = [];

    vi.mocked(generateText).mockImplementation(async () => {
      options.push(await readGatewayOptions());
      return createGenerateTextResult({ releases: [] });
    });

    await readProductPages({ analytics, hints: HINTS, pages: [PAGE] });
    await readProductPages({ analytics, hints: named, known: true, pages: [PAGE] });
    await readProductPages({ analytics, hints: HINTS, known: true, pages: [PAGE] });

    expect(options).toStrictEqual([
      { disallowPromptTraining: true },
      { disallowPromptTraining: true },
      undefined,
    ]);
  });

  it("fails an empty answer the provider's filter stopped as a reading the schema can't accept", async () => {
    await answerEmptyOnce("content-filter");

    await expect(
      readProductPages({ hints: HINTS, known: true, pages: [PAGE] }),
    ).rejects.toMatchObject({ finishReason: "content-filter", name: "AI_NoObjectGeneratedError" });
  });

  it("leaves an empty answer for any other reason as missing output, which a retry can fix", async () => {
    await answerEmptyOnce("error");

    await expect(
      readProductPages({ hints: HINTS, known: true, pages: [PAGE] }),
    ).rejects.toMatchObject({ name: "AI_NoOutputGeneratedError" });
  });
});
