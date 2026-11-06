import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { findProductPages } from "./find-product-pages";
import type * as SearchTools from "./research-search-tools";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./find-product-pages.prompt.md", () => ({
  default:
    "Find the pages.\n{{#known}}\nOnly the release page.\n{{/known}}\n{{#release}}\nThe named release.\n{{/release}}\n",
}));

vi.mock("./research-search-tools", async (importOriginal) => ({
  ...(await importOriginal<typeof SearchTools>()),
  buildResearchSearchTools: vi.fn(() => ({})),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const HINTS = { brand: "Lumen Works", name: "Orbit Notes", release: null };

describe(findProductPages, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only addresses on sites a search returned", async () => {
    vi.mocked(generateText).mockResolvedValue({
      ...createGenerateTextResult({
        brandUrl: "https://lumen.example/",
        docsUrl: "https://docs.orbit.example/",
        productUrl: "https://lumen.example/orbit",
        releaseUrl: null,
        releasesUrl: "https://invented.example/releases",
      }),
      sources: [{ url: "https://lumen.example/" }, { url: "https://docs.orbit.example/start" }],
    } as never);

    const { data } = await findProductPages({ hints: HINTS, officialDomains: ["lumen.example"] });

    expect(data).toMatchObject({
      brandUrl: "https://lumen.example/",
      docsUrl: "https://docs.orbit.example/",
      productUrl: "https://lumen.example/orbit",
      releaseUrl: null,
      releasesUrl: null,
    });
  });

  it("asks only for the named release's page when the product is known", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        brandUrl: null,
        docsUrl: null,
        productUrl: null,
        releaseUrl: null,
        releasesUrl: null,
      }),
    );

    const search = await findProductPages({ hints: HINTS, officialDomains: [] });

    const known = await findProductPages({
      hints: { ...HINTS, release: "Orbit Notes 5" },
      knownWebsite: "https://lumen.example/orbit",
      officialDomains: [],
    });

    expect(search.systemPrompt).toBe("Find the pages.\n");

    expect(known.systemPrompt).toBe(
      "Find the pages.\nOnly the release page.\nThe named release.\n",
    );

    expect(known.userPrompt).toContain("KNOWN_WEBSITE: https://lumen.example/orbit");
  });
});
