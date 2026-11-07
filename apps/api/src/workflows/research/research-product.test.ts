import { randomUUID } from "node:crypto";
import { detectChangingFacts } from "@zoonk/ai/tasks/research/changing-facts";
import { findProductPages } from "@zoonk/ai/tasks/research/find-product-pages";
import { type ProductReading, readProductPages } from "@zoonk/ai/tasks/research/read-product-pages";
import { generateSourceResearchPlan } from "@zoonk/ai/tasks/research/source-plan";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { getRun } from "workflow/api";
import { mockHookConflict } from "../../../mocks/workflow";
import { readProductReleases } from "../products/product-releases";
import { researchWorkflow } from "./research-workflow";

const PROVENANCE = {
  costUsd: 0,
  generatedAt: "2026-11-06T12:00:00.000Z",
  latencyMs: 1,
  model: "openai/gpt-6.1-terra",
  promptVersion: "v1",
  provider: "openai",
  requestedModel: "openai/gpt-6.1-terra",
  runId: "recorded",
  usage: {},
};

const TASK_RESULT = {
  provenance: PROVENANCE,
  systemPrompt: "",
  usage: {} as never,
  userPrompt: "",
};

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>`;

function requestedUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }

  return "href" in input ? input.href : input.url;
}

type Site = { brand: string; brandName: string; product: string };

function newSite(): Site {
  const key = randomUUID().slice(0, 8);

  return {
    brand: `lumen-${key}.example`,
    brandName: `Lumen ${key}`,
    product: `orbit-${key}.example`,
  };
}

function html(body: string): PageResponse {
  return new PageResponse(`<html><head></head><body>${body}</body></html>`, {
    headers: { "content-type": "text/html" },
  });
}

/** The brand's and the product's sites, linking to each other unless `tied` is false. */
/** `others` answers exact addresses: a page's body, or `{ redirect }` for a 302. */
function servePages({
  others = {},
  releases = "<p>Orbit Notes 5 shipped on October 21, 2025.</p>",
  site,
  tied = true,
}: {
  others?: Record<string, string | { redirect: string }>;
  releases?: string;
  site: Site;
  tied?: boolean;
}) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = new URL(requestedUrl(input));
    const other = others[url.href];

    if (typeof other === "string") {
      return html(other);
    }

    if (other) {
      return new PageResponse(null, { headers: { location: other.redirect }, status: 302 });
    }

    if (url.pathname.endsWith(".svg")) {
      return new PageResponse(ICON, { headers: { "content-type": "image/svg+xml" } });
    }

    if (url.hostname === site.brand) {
      return html(
        `<link rel="icon" href="/logo.svg"><p>Orbit Notes is made by Lumen Works.</p>${
          tied ? `<a href="https://${site.product}/">Orbit Notes</a>` : ""
        }`,
      );
    }

    if (url.pathname.startsWith("/releases")) {
      return html(releases);
    }

    return html(
      `<meta property="og:image" content="https://${site.product}/share.svg"><p>Orbit Notes is the note app for teams.</p><a href="https://${site.brand}/">Lumen Works</a>`,
    );
  });
}

function planProduct({ release = null, site }: { release?: string | null; site: Site }) {
  vi.mocked(generateSourceResearchPlan).mockResolvedValue({
    ...TASK_RESULT,
    data: {
      country: "ZZ",
      language: "en",
      name: "Orbit Notes",
      officialDomains: [site.product, site.brand],
      product: { brand: site.brandName, name: "Orbit Notes", release },
      queries: ["orbit notes release notes"],
      searchTerms: ["orbit notes"],
    },
  });
}

function findPages(site: Site) {
  vi.mocked(findProductPages).mockResolvedValue({
    ...TASK_RESULT,
    data: {
      brandUrl: `https://${site.brand}/`,
      docsUrl: `https://${site.product}/docs`,
      productUrl: `https://${site.product}/`,
      releaseUrl: null,
      releasesUrl: `https://${site.product}/releases`,
      searchCalls: 2,
    },
  });
}

const READING: ProductReading = {
  brand: {
    description: "A software company.",
    document: 1,
    name: "Lumen Works",
    passage: "Orbit Notes is made by Lumen Works.",
    steward: false,
  },
  learnerRelease: null,
  product: {
    aliases: [],
    description: "A note-taking app for teams.",
    document: 2,
    name: "Orbit Notes",
    passage: "Orbit Notes is the note app for teams.",
  },
  releases: [
    {
      document: 4,
      name: "Orbit Notes 5",
      passage: "Orbit Notes 5 shipped on October 21, 2025.",
      releasedOn: "2025-10-21",
      supportEndsOn: null,
      version: "5",
    },
  ],
};

function readPages(reading: ProductReading = READING) {
  vi.mocked(readProductPages).mockResolvedValue({ ...TASK_RESULT, data: reading });
}

async function productGoal() {
  const user = await userFixture();
  return goalFixture({ prompt: "learn Orbit Notes for my team", userId: user.id });
}

/** A product research saved earlier, with no releases page unless one is given. */
async function savedProduct(site: Site, attrs: Parameters<typeof productFixture>[0] = {} as never) {
  const brand = await brandFixture({ domain: site.brand, website: `https://${site.brand}/` });

  return productFixture({
    name: "Orbit Notes",
    normalizedName: "orbitnotes",
    website: `https://${site.product}/`,
    ...attrs,
    organizationId: brand.id,
  });
}

function readReleases(productId: string) {
  return readProductReleases({
    analytics: { contentScope: "shared" },
    productId,
    release: null,
    serviceTier: undefined,
  });
}

/**
 * Research finds the product's pages, then the newest release's own page, after one failed search
 * when `outage` is set.
 */
function findReleasePage({
  outage,
  releasePage,
  site,
}: {
  outage: boolean;
  releasePage: string;
  site: Site;
}) {
  findPages(site);

  const search = vi
    .mocked(findProductPages)
    .mockResolvedValueOnce({
      ...TASK_RESULT,
      data: {
        brandUrl: `https://${site.brand}/`,
        docsUrl: `https://${site.product}/docs`,
        productUrl: `https://${site.product}/`,
        releaseUrl: null,
        releasesUrl: `https://${site.product}/releases`,
        searchCalls: 2,
      },
    });

  if (outage) {
    search.mockRejectedValueOnce(new Error("Search is down"));
  }

  search.mockResolvedValueOnce({
    ...TASK_RESULT,
    data: {
      brandUrl: null,
      docsUrl: null,
      productUrl: null,
      releaseUrl: releasePage,
      releasesUrl: null,
      searchCalls: 1,
    },
  });
}

describe("product research", () => {
  beforeEach(() => {
    vi.mocked(detectChangingFacts).mockResolvedValue("product");

    vi.mocked(uploadImage).mockImplementation(async ({ fileName }) => ({
      data: `https://blob.example/${fileName}`,
      error: null,
    }));
  });

  it("researches a new product once: search, tie the sites, read, save and link", async () => {
    const site = newSite();
    const goal = await productGoal();
    planProduct({ site });
    findPages(site);
    servePages({ site });
    readPages();

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      examBlueprintId: null,
      sourceIds: [],
      status: "ready",
    });

    const brand = await prisma.organization.findUniqueOrThrow({
      include: {
        products: {
          include: { docsSource: true, releases: true, releasesSource: true, websiteSource: true },
        },
      },
      where: { domain: site.brand },
    });

    const [product] = brand.products;

    expect(brand).toMatchObject({
      kind: "brand",
      logo: `https://blob.example/brands/${brand.id}/logo.webp`,
      name: "Lumen Works",
      website: `https://${site.brand}/`,
    });

    expect(product).toMatchObject({
      docsSource: { url: `https://${site.product}/docs` },
      imageUrl: `https://blob.example/products/${product?.id}/image.webp`,
      name: "Orbit Notes",
      releasesSource: { url: `https://${site.product}/releases` },
      website: `https://${site.product}/`,
      websiteSource: { url: `https://${site.product}/` },
    });

    expect(product?.releases.map((release) => [release.name, release.releasedAt])).toStrictEqual([
      ["Orbit Notes 5", new Date("2025-10-21T00:00:00.000Z")],
    ]);

    expect(
      vi.mocked(readProductPages).mock.calls[0]?.[0].pages.map((page) => page.url),
    ).toStrictEqual([
      `https://${site.brand}/`,
      `https://${site.product}/`,
      `https://${site.product}/docs`,
      `https://${site.product}/releases`,
    ]);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productCheckedAt: expect.any(Date),
      productId: product?.id,
      productReleaseId: null,
    });

    await expect(prisma.learnerSource.count({ where: { userId: goal.userId } })).resolves.toBe(0);
  });

  it("saves nothing while the releases page fails, so a later learner researches it again", async () => {
    const site = newSite();
    const [first, later] = [await productGoal(), await productGoal()];
    planProduct({ site });
    findPages(site);
    servePages({ site });
    readPages();

    const serve = vi.mocked(fetch).getMockImplementation();
    const releasesUrl = `https://${site.product}/releases`;

    vi.mocked(fetch).mockImplementation(async (input, init) =>
      requestedUrl(input) === releasesUrl
        ? new PageResponse("Unavailable", { status: 503 })
        : serve!(input, init),
    );

    await expect(researchWorkflow({ goalId: first.id })).rejects.toThrow("503");
    await expect(prisma.organization.count({ where: { domain: site.brand } })).resolves.toBe(0);

    servePages({ site });
    await researchWorkflow({ goalId: later.id });

    const product = await prisma.product.findFirstOrThrow({
      include: { releasesSource: true },
      where: { organization: { domain: site.brand } },
    });

    expect(product.releasesSource?.url).toBe(releasesUrl);
  });

  it("takes a release row naming only its version from the releases page, never from a sibling product's line", async () => {
    const site = newSite();
    const goal = await productGoal();
    const brand = await brandFixture({ domain: site.brand, website: `https://${site.brand}/` });

    await productFixture({
      name: "Comet Phone",
      normalizedName: "cometphone",
      organizationId: brand.id,
    });

    planProduct({ site });
    findPages(site);

    servePages({
      releases:
        "<p>Releases</p><p>| 5.1 | 2025-11-02 |</p><p>Comet Phone 6.2 shipped on 2025-11-03.</p>",
      site,
    });

    readPages({
      ...READING,
      releases: [
        {
          document: 4,
          name: "Orbit Notes 5.1",
          passage: "| 5.1 | 2025-11-02 |",
          releasedOn: "2025-11-02",
          supportEndsOn: null,
          version: "5.1",
        },
        {
          document: 4,
          name: "Orbit Notes 6.2",
          passage: "6.2 shipped on 2025-11-03.",
          releasedOn: "2025-11-03",
          supportEndsOn: null,
          version: "6.2",
        },
      ],
    });

    await researchWorkflow({ goalId: goal.id });

    const product = await prisma.product.findFirstOrThrow({
      include: { releases: true },
      where: { normalizedName: "orbitnotes", organizationId: brand.id },
    });

    expect(product.releases.map((release) => [release.name, release.releasedAt])).toStrictEqual([
      ["Orbit Notes 5.1", new Date("2025-11-02T00:00:00.000Z")],
    ]);
  });

  describe("a product whose releases page dates none", () => {
    const UNDATED = [
      { name: "Orbit Notes 5.1", version: "5.1" },
      { name: "Orbit Notes 5.2", version: "5.2" },
    ].map((release) => ({
      ...release,
      document: 4,
      passage: release.name,
      releasedOn: null,
      supportEndsOn: null,
    }));

    /** The releases page lists both versions undated; the newest one's page says what it says. */
    async function research({
      outage = false,
      ...releaseNote
    }: {
      outage?: boolean;
      passage: string;
      releasedOn: string | null;
    }) {
      const site = newSite();
      const goal = await productGoal();
      const releasePage = `https://${site.product}/news/orbit-notes-5-2`;
      planProduct({ site });
      findReleasePage({ outage, releasePage, site });

      servePages({
        others: { [releasePage]: `<p>${releaseNote.passage}</p>` },
        releases: "<p>Orbit Notes 5.1</p><p>Orbit Notes 5.2</p>",
        site,
      });

      vi.mocked(readProductPages)
        .mockResolvedValueOnce({ ...TASK_RESULT, data: { ...READING, releases: UNDATED } })
        .mockResolvedValueOnce({
          ...TASK_RESULT,
          data: {
            brand: null,
            learnerRelease: "Orbit Notes 5.2",
            product: null,
            releases: [{ ...UNDATED[1]!, document: 1, ...releaseNote }],
          },
        });

      const [run] = await Promise.allSettled([researchWorkflow({ goalId: goal.id })]);

      const product = await prisma.product.findFirstOrThrow({
        include: { releases: { orderBy: { name: "asc" } } },
        where: { organization: { domain: site.brand } },
      });

      const linked = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      return { linked, product, status: run.status };
    }

    it("looks up the newest release's own page and ends with a current release", async () => {
      const { product, status } = await research({
        passage: "Orbit Notes 5.2 shipped on November 2, 2025.",
        releasedOn: "2025-11-02",
      });

      expect(status).toBe("fulfilled");
      expect(vi.mocked(findProductPages).mock.calls[1]?.[0].hints.release).toBe("Orbit Notes 5.2");

      expect(product.releases.map((release) => [release.name, release.releasedAt])).toStrictEqual([
        ["Orbit Notes 5.1", null],
        ["Orbit Notes 5.2", new Date("2025-11-02T00:00:00.000Z")],
      ]);
    });

    it("looks a newest release's page up once, even when it has no date either", async () => {
      const { product, status } = await research({
        passage: "Orbit Notes 5.2 brings shared notebooks.",
        releasedOn: null,
      });

      await readReleases(product.id);

      expect(status).toBe("fulfilled");
      expect(vi.mocked(findProductPages)).toHaveBeenCalledTimes(2);
      expect(product.releases.map((release) => release.releasedAt)).toStrictEqual([null, null]);
    });

    it("links the goal when the newest release's search fails, and looks the page up again later", async () => {
      const { linked, product, status } = await research({
        outage: true,
        passage: "Orbit Notes 5.2 shipped on November 2, 2025.",
        releasedOn: "2025-11-02",
      });

      await readReleases(product.id);

      const releases = await prisma.productRelease.findMany({
        orderBy: { name: "asc" },
        where: { productId: product.id },
      });

      expect(status).toBe("fulfilled");
      expect(linked).toMatchObject({ productCheckedAt: expect.any(Date), productId: product.id });
      expect(vi.mocked(findProductPages)).toHaveBeenCalledTimes(3);

      expect(releases.map((release) => release.releasedAt)).toStrictEqual([
        null,
        new Date("2025-11-02T00:00:00.000Z"),
      ]);
    });
  });

  it("pins a named older model when the models page gives only years", async () => {
    const site = newSite();
    const goal = await productGoal();
    planProduct({ release: "Orbit Notes 13", site });
    findPages(site);

    servePages({
      releases:
        "<p>Orbit Notes 15</p><p>Year introduced: 2025</p><p>Orbit Notes 13</p><p>Year introduced: 2021</p>",
      site,
    });

    readPages({
      ...READING,
      learnerRelease: "Orbit Notes 13",
      releases: ["Orbit Notes 15", "Orbit Notes 13"].map((name) => ({
        document: 4,
        name,
        passage: `${name} Year introduced`,
        releasedOn: null,
        supportEndsOn: null,
        version: null,
      })),
    });

    await researchWorkflow({ goalId: goal.id });

    const named = await prisma.productRelease.findFirstOrThrow({
      where: { name: "Orbit Notes 13", product: { organization: { domain: site.brand } } },
    });

    expect(named.releasedAt).toBeNull();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productId: named.productId,
      productReleaseId: named.id,
    });
  });

  it("never stores a page that redirects off the official sites", async () => {
    const site = newSite();
    const goal = await productGoal();
    const elsewhere = `https://unrelated-${randomUUID().slice(0, 8)}.example/releases`;
    planProduct({ site });
    findPages(site);

    servePages({
      others: {
        [`https://${site.product}/releases`]: { redirect: elsewhere },
        [elsewhere]: "<p>Orbit Notes 999 shipped on January 1, 2026.</p>",
      },
      site,
    });

    readPages({ ...READING, releases: [] });

    await researchWorkflow({ goalId: goal.id });

    await expect(prisma.source.count({ where: { url: elsewhere } })).resolves.toBe(0);

    expect(
      vi.mocked(readProductPages).mock.calls[0]?.[0].pages.map((page) => page.url),
    ).toStrictEqual([
      `https://${site.brand}/`,
      `https://${site.product}/`,
      `https://${site.product}/docs`,
    ]);
  });

  it("keeps a stale product's releases when its page now redirects to another site", async () => {
    const site = newSite();
    const releasesUrl = `https://${site.product}/releases`;
    const elsewhere = `https://unrelated-${randomUUID().slice(0, 8)}.example/releases`;

    servePages({
      others: {
        [elsewhere]: "<p>Orbit Notes 999 shipped on January 1, 2026.</p>",
        [releasesUrl]: { redirect: elsewhere },
      },
      site,
    });

    const releasesSource = await sourceFixture({
      contentHash: "old-hash",
      fetchedAt: new Date("2026-01-01T00:00:00Z"),
      structure: { images: 0, pages: null, topic: "product" },
      url: releasesUrl,
    });

    const [goal, product] = await Promise.all([
      productGoal(),
      savedProduct(site, {
        releasesHash: "old-hash",
        releasesSourceId: releasesSource.id,
      } as never),
    ]);

    planProduct({ site });

    await researchWorkflow({ goalId: goal.id });

    expect(readProductPages).not.toHaveBeenCalled();

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: releasesSource.id } }),
    ).resolves.toMatchObject({ contentHash: "old-hash" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productId: product.id,
    });
  });

  it("finds a named release under the product's verified code host", async () => {
    const site = newSite();
    const repo = `https://code.example/lumen-${randomUUID().slice(0, 8)}/orbit`;
    const releaseUrl = `${repo}/releases/tag/v13`;
    const product = await savedProduct(site);

    const releasesPage = await sourceFixture({ url: `${repo}/releases` });

    const [goal] = await Promise.all([
      productGoal(),
      productReleaseFixture({
        name: "Orbit Notes 15",
        normalizedName: "orbitnotes15",
        productId: product.id,
        releasedAt: new Date("2025-10-21"),
        sourceId: releasesPage.id,
      }),
    ]);

    planProduct({ release: "Orbit Notes 13", site });

    servePages({
      others: { [releaseUrl]: "<p>Orbit Notes 13 released on May 2, 2024.</p>" },
      site,
    });

    vi.mocked(findProductPages).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        brandUrl: null,
        docsUrl: null,
        productUrl: null,
        releaseUrl,
        releasesUrl: null,
        searchCalls: 1,
      },
    });

    readPages({
      brand: null,
      learnerRelease: "Orbit Notes 13",
      product: null,
      releases: [
        {
          document: 1,
          name: "Orbit Notes 13",
          passage: "Orbit Notes 13 released on May 2, 2024.",
          releasedOn: "2024-05-02",
          supportEndsOn: null,
          version: "13",
        },
      ],
    });

    await researchWorkflow({ goalId: goal.id });

    const named = await prisma.productRelease.findFirstOrThrow({
      where: { name: "Orbit Notes 13", productId: product.id },
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productId: product.id,
      productReleaseId: named.id,
    });
  });

  it("links a known, fresh product with no search, fetch or reading", async () => {
    const site = newSite();
    const [goal, product] = await Promise.all([productGoal(), savedProduct(site)]);
    planProduct({ site });

    await researchWorkflow({ goalId: goal.id });

    expect(findProductPages).not.toHaveBeenCalled();
    expect(readProductPages).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productCheckedAt: expect.any(Date),
      productId: product.id,
    });
  });

  it("pins a goal to the older release its learner named", async () => {
    const site = newSite();
    const [goal, product] = await Promise.all([productGoal(), savedProduct(site)]);

    const [older] = await Promise.all([
      productReleaseFixture({
        name: "Orbit Notes 4",
        normalizedName: "orbitnotes4",
        productId: product.id,
        releasedAt: new Date("2024-05-02"),
      }),
      productReleaseFixture({
        name: "Orbit Notes 5",
        normalizedName: "orbitnotes5",
        productId: product.id,
        releasedAt: new Date("2025-10-21"),
      }),
    ]);

    planProduct({ release: "Orbit Notes 4", site });

    await researchWorkflow({ goalId: goal.id });

    expect(findProductPages).not.toHaveBeenCalled();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productId: product.id,
      productReleaseId: older.id,
    });
  });

  it("reads a stale product's releases page again only when its hash moved", async () => {
    const site = newSite();
    const releasesUrl = `https://${site.product}/releases`;
    servePages({ site });

    const stale = new Date("2026-01-01T00:00:00Z");

    const releasesSource = await sourceFixture({
      contentHash: "old-hash",
      fetchedAt: stale,
      url: releasesUrl,
    });

    const [goal, product] = await Promise.all([
      productGoal(),
      savedProduct(site, {
        releasesHash: "old-hash",
        releasesSourceId: releasesSource.id,
      } as never),
    ]);

    planProduct({ site });

    readPages({
      ...READING,
      brand: null,
      product: null,
      releases: [{ ...READING.releases[0]!, document: 1 }],
    });

    await researchWorkflow({ goalId: goal.id });

    expect(findProductPages).not.toHaveBeenCalled();
    expect(readProductPages).toHaveBeenCalledOnce();
    expect(vi.mocked(readProductPages).mock.calls[0]?.[0].known).toBe(true);

    const refreshed = await prisma.source.findUniqueOrThrow({ where: { id: releasesSource.id } });

    await expect(
      prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
    ).resolves.toMatchObject({ releasesHash: refreshed.contentHash });

    await expect(
      prisma.productRelease.findMany({ select: { name: true }, where: { productId: product.id } }),
    ).resolves.toStrictEqual([{ name: "Orbit Notes 5" }]);

    // A week later the page is the same: the saved releases came from it, so nothing is read.
    await prisma.source.update({ data: { fetchedAt: stale }, where: { id: releasesSource.id } });
    vi.mocked(readProductPages).mockClear();
    const second = await productGoal();

    await researchWorkflow({ goalId: second.id });

    expect(readProductPages).not.toHaveBeenCalled();
  });

  it("lets a second learner wait for the run already researching the product", async () => {
    const site = newSite();
    const goal = await productGoal();
    planProduct({ site });

    mockHookConflict(
      { returnValue: Promise.resolve(null), runId: "other-run" },
      { tokens: /^product:/u },
    );

    vi.mocked(getRun).mockReturnValue({
      cancel: vi.fn(),
      exists: Promise.resolve(true),
      status: Promise.resolve("running"),
    } as unknown as ReturnType<typeof getRun>);

    // The other run saves the product while this one waits, then lets go of the token.
    vi.mocked(sleep).mockImplementationOnce(async () => {
      await savedProduct(site);
      mockHookConflict(null);
    });

    await researchWorkflow({ goalId: goal.id });

    expect(findProductPages).not.toHaveBeenCalled();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productId: expect.any(String),
    });
  });

  it("takes the brand from the product site's domain when the search finds no brand page", async () => {
    const site = newSite();
    const goal = await productGoal();
    planProduct({ site });
    servePages({ site });
    readPages({ ...READING, releases: [] });

    vi.mocked(findProductPages).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        brandUrl: null,
        docsUrl: null,
        productUrl: `https://developer.${site.brand}/orbit`,
        releaseUrl: null,
        releasesUrl: null,
        searchCalls: 1,
      },
    });

    await researchWorkflow({ goalId: goal.id });

    const brand = await prisma.organization.findUniqueOrThrow({
      include: { products: true },
      where: { domain: site.brand },
    });

    expect(brand.website).toBe(`https://${site.brand}/`);

    expect(brand.products.map((product) => product.website)).toStrictEqual([
      `https://developer.${site.brand}/orbit`,
    ]);
  });

  it("saves nothing when the brand's site doesn't link back to the product's", async () => {
    const site = newSite();
    const goal = await productGoal();
    planProduct({ site });
    findPages(site);
    servePages({ site, tied: false });
    readPages();

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      reason: "noOfficialSource",
      status: "needsUpload",
    });

    expect(readProductPages).not.toHaveBeenCalled();
    await expect(prisma.organization.count({ where: { domain: site.brand } })).resolves.toBe(0);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productCheckedAt: expect.any(Date),
      productId: null,
    });
  });

  it("saves nothing when the reading finds no brand, such as a foundation's project", async () => {
    const site = newSite();
    const goal = await productGoal();
    planProduct({ site });
    findPages(site);
    servePages({ site });
    readPages({ ...READING, brand: { ...READING.brand!, steward: true } });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      status: "needsUpload",
    });

    await expect(prisma.organization.count({ where: { domain: site.brand } })).resolves.toBe(0);
  });

  it("links a goal started from a product's course without planning or searching", async () => {
    const user = await userFixture();
    const site = newSite();
    const product = await savedProduct(site);

    const course = await courseFixture({
      organizationId: product.organizationId,
      productId: product.id,
    });

    const goal = await goalFixture({ primaryCourseId: course.id, userId: user.id });

    await researchWorkflow({ goalId: goal.id });

    expect(generateSourceResearchPlan).not.toHaveBeenCalled();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productCheckedAt: expect.any(Date),
      productId: product.id,
    });
  });

  it("plans from what the learner typed, so a release the title leaves out still reaches the plan", async () => {
    const site = newSite();
    const user = await userFixture();
    const prompt = "I use Orbit Notes 5 at work and want to master its sharing";
    const title = "Master sharing in Orbit Notes";
    const goal = await goalFixture({ prompt, title, userId: user.id });
    planProduct({ site });
    findPages(site);
    servePages({ site });
    readPages();

    await researchWorkflow({ goalId: goal.id });

    expect(vi.mocked(generateSourceResearchPlan).mock.lastCall?.[0]).toMatchObject({
      analytics: { contentScope: "personal" },
      goal: `${title}\n${prompt}`,
      topic: "product",
    });
  });

  it("records the product decision right after the classifier for other topics", async () => {
    vi.mocked(detectChangingFacts).mockResolvedValue("none");
    const goal = await productGoal();

    await researchWorkflow({ goalId: goal.id });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      productCheckedAt: expect.any(Date),
      productId: null,
    });
  });
});
