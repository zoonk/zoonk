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
function servePages({
  releases = "<p>Orbit Notes 5 shipped on October 21, 2025.</p>",
  site,
  tied = true,
}: {
  releases?: string;
  site: Site;
  tied?: boolean;
}) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = new URL(requestedUrl(input));

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
      include: { products: { include: { releases: true, sources: true } } },
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
      docsUrl: `https://${site.product}/docs`,
      imageUrl: `https://blob.example/products/${product?.id}/image.webp`,
      name: "Orbit Notes",
      website: `https://${site.product}/`,
    });

    expect(product?.releases.map((release) => [release.name, release.releasedAt])).toStrictEqual([
      ["Orbit Notes 5", new Date("2025-10-21T00:00:00.000Z")],
    ]);

    expect(product?.sources.map((source) => source.url).toSorted()).toStrictEqual([
      `https://${site.product}/`,
      `https://${site.product}/docs`,
      `https://${site.product}/releases`,
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
