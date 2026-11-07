import { readProductPages } from "@zoonk/ai/tasks/research/read-product-pages";
import { prisma } from "@zoonk/db";
import { brandFixture, productFixture } from "@zoonk/testing/fixtures/products";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it, vi } from "vitest";
import { findUnreadReleasesPage, readReleasesPage } from "./product-releases";
import type * as ReadProductPages from "@zoonk/ai/tasks/research/read-product-pages";

vi.mock("@zoonk/ai/tasks/research/read-product-pages", async (importOriginal) => ({
  ...(await importOriginal<typeof ReadProductPages>()),
  readProductPages: vi.fn(),
}));

describe(readReleasesPage, () => {
  it("reads the page version it was given, with its hash, when the page changed since", async () => {
    const text = "Test Product 2 was released on January 10, 2026.";
    const source = await sourceFixture({ extractedText: text, title: "Releases" });
    const brand = await brandFixture();
    const product = await productFixture({ organizationId: brand.id, releasesSourceId: source.id });
    const page = await findUnreadReleasesPage(product.id);

    await prisma.source.update({
      data: { contentHash: `${source.contentHash}-newer`, extractedText: "Test Product 3 is out." },
      where: { id: source.id },
    });

    vi.mocked(readProductPages).mockResolvedValueOnce({
      data: { brand: null, learnerRelease: null, product: null, releases: [] },
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    const reading = await readReleasesPage({ page: page!, release: null });

    expect(vi.mocked(readProductPages).mock.lastCall?.[0].pages).toStrictEqual([
      { text, title: "Releases", url: source.url },
    ]);

    expect(reading.contentHash).toBe(source.contentHash);
  });
});
