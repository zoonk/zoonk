import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { listGoalReferences } from "../curriculum/goal-references";
import { countActiveSourceGoals } from "../exams/exam-learners";
import { loadLessonDocuments } from "../lessons/_utils/lesson-sources";
import { findProductCheckedSourceId } from "./goal-product-link";
import {
  type ProductResearch,
  saveProductReleases,
  saveProductResearch,
} from "./save-product-research";

const provenance = {
  generatedAt: new Date(),
  model: "google/gemini-3.8-flash",
  promptVersion: "test-v1",
  runId: "test-run",
};

async function research(attrs?: Partial<ProductResearch>): Promise<ProductResearch> {
  const key = randomUUID().slice(0, 8);

  const [productPage, docsPage, releasesPage] = await Promise.all([
    sourceFixture(),
    sourceFixture(),
    sourceFixture(),
  ]);

  return {
    brand: {
      description: "Makes tools for building websites.",
      domain: `brand-${key}.test`,
      name: `Brand ${key}`,
      website: `https://brand-${key}.test/`,
    },
    product: {
      aliases: [`WJS ${key}`, `Widget JS ${key}`],
      description: "A framework for building websites.",
      docsSourceId: docsPage.id,
      name: `Widget.js ${key}`,
      website: `https://widget-${key}.test/`,
      websiteSourceId: productPage.id,
    },
    provenance,
    releases: [
      {
        name: `Widget.js ${key} 15`,
        releasedAt: new Date("2025-10-21"),
        sourceId: releasesPage.id,
        supportEndsAt: null,
        version: "15",
      },
      {
        name: `Widget.js ${key} 16`,
        releasedAt: null,
        sourceId: releasesPage.id,
        supportEndsAt: null,
        version: "16",
      },
    ],
    releasesHash: releasesPage.contentHash,
    releasesSourceId: releasesPage.id,
    ...attrs,
  };
}

describe(saveProductResearch, () => {
  it("stores the brand by its domain, the product under it, its releases and its pages", async () => {
    const input = await research();
    const saved = await saveProductResearch(input);

    expect(saved.organization).toMatchObject({
      domain: input.brand.domain,
      kind: "brand",
      name: input.brand.name,
      website: input.brand.website,
    });

    expect(saved.product).toMatchObject({
      docsSourceId: input.product.docsSourceId,
      organizationId: saved.organization.id,
      releasesHash: input.releasesHash,
      releasesSourceId: input.releasesSourceId,
      websiteSourceId: input.product.websiteSourceId,
    });

    expect(saved.releases.map((release) => release.version)).toStrictEqual(["15", "16"]);

    expect(saved.newReleaseIds.toSorted()).toStrictEqual(
      saved.releases.map((release) => release.id).toSorted(),
    );
  });

  it("keeps what an earlier reading saved, adds what a later one finds and reports only releases it stored first", async () => {
    const first = await research();
    const saved = await saveProductResearch(first);
    const later = await sourceFixture({ contentHash: "hash-later" });

    const again = await saveProductResearch({
      ...first,
      brand: { ...first.brand, description: "Another description.", name: "Renamed Brand" },
      product: {
        ...first.product,
        aliases: [...first.product.aliases, `${first.product.name} Framework`],
        description: "Another description.",
      },
      releases: [
        {
          name: `${first.product.name} 16`,
          releasedAt: new Date("2026-10-21"),
          sourceId: null,
          supportEndsAt: null,
          version: null,
        },
        {
          name: `${first.product.name} 17`,
          releasedAt: new Date("2026-12-15"),
          sourceId: later.id,
          supportEndsAt: null,
          version: "17",
        },
      ],
      releasesHash: "hash-later",
    });

    expect(again.organization).toMatchObject({ id: saved.organization.id, name: first.brand.name });

    expect(again.product).toMatchObject({
      description: first.product.description,
      id: saved.product.id,
      releasesHash: "hash-later",
    });

    expect(again.product.aliases).toHaveLength(2);

    const sixteen = again.releases.find((release) => release.version === "16");
    expect(sixteen?.releasedAt).toStrictEqual(new Date("2026-10-21"));
    expect(sixteen?.sourceId).toBe(first.releasesSourceId);

    const seventeen = again.releases.find((release) => release.version === "17");
    expect(again.newReleaseIds).toStrictEqual([seventeen?.id]);
  });

  it("makes one brand, one product and one row per release when two learners' research saves at once", async () => {
    const input = await research();

    const [first, second] = await Promise.all([
      saveProductResearch(input),
      saveProductResearch(input),
    ]);

    expect(second.organization.id).toBe(first.organization.id);
    expect(second.product.id).toBe(first.product.id);

    await expect(
      prisma.productRelease.count({ where: { productId: first.product.id } }),
    ).resolves.toBe(2);

    expect([...first.newReleaseIds, ...second.newReleaseIds].toSorted()).toStrictEqual(
      first.releases.map((release) => release.id).toSorted(),
    );
  });

  it("gives two brands with one name their own slugs", async () => {
    const [first, second] = await Promise.all([research(), research()]);
    const name = `Mercury ${randomUUID().slice(0, 8)}`;

    const saved = await Promise.all([
      saveProductResearch({ ...first, brand: { ...first.brand, name } }),
      saveProductResearch({ ...second, brand: { ...second.brand, name } }),
    ]);

    expect(new Set(saved.map((item) => item.organization.slug)).size).toBe(2);
  });

  it("lets every product whose research reads one docs page reach it", async () => {
    const docs = await sourceFixture({
      extractedText: "To pair the remote, hold the dock button until the light blinks.",
      structure: { images: 0, pages: null, topic: "product" },
      title: "Brand docs",
    });

    const [first, second] = await Promise.all([research(), research()]);

    const withDocs = (input: ProductResearch) => ({
      ...input,
      product: { ...input.product, docsSourceId: docs.id, websiteSourceId: null },
      releases: [],
      releasesHash: null,
      releasesSourceId: null,
    });

    await saveProductResearch(withDocs(first));
    const saved = await saveProductResearch(withDocs(second));

    await expect(findProductCheckedSourceId(saved.product.id)).resolves.toBe(docs.id);

    const user = await userFixture();
    await goalFixture({ productId: saved.product.id, userId: user.id });
    await expect(countActiveSourceGoals(docs.id)).resolves.toBe(1);

    await expect(
      listGoalReferences({ goalId: randomUUID(), productId: saved.product.id }),
    ).resolves.toStrictEqual([{ text: docs.extractedText, title: "Brand docs" }]);

    const course = await courseFixture({
      organizationId: saved.organization.id,
      productId: saved.product.id,
    });

    const chapter = await libraryChapterFixture({ homeCourseId: course.id });

    const lesson = await libraryLessonFixture({
      homeChapterId: chapter.id,
      title: "Pair the remote",
    });

    const documents = await loadLessonDocuments({
      chapterId: chapter.id,
      courseId: course.id,
      lessonId: lesson.id,
      query: "Pair the remote with the dock",
    });

    expect(documents.sources.map((page) => page.sourceId)).toStrictEqual([docs.id]);
  });

  it("keeps the releases page a product has, and the hash its releases were read from", async () => {
    const input = await research();
    const first = await saveProductResearch(input);
    const otherPage = await sourceFixture({ contentHash: "hash-other-page" });

    const again = await saveProductResearch({
      ...input,
      releasesHash: "hash-other-page",
      releasesSourceId: otherPage.id,
    });

    expect(again.product).toMatchObject({
      releasesHash: first.product.releasesHash,
      releasesSourceId: input.releasesSourceId,
    });
  });

  it("keeps two releases whose long names share their first fifty characters", async () => {
    const input = await research();
    const wave = `${input.product.name} 2026 release wave for business central`;

    const saved = await saveProductResearch({
      ...input,
      releases: [1, 2].map((number) => ({
        name: `${wave} ${number}`,
        releasedAt: null,
        sourceId: null,
        supportEndsAt: null,
        version: null,
      })),
    });

    expect(saved.releases.map((release) => release.name)).toStrictEqual([`${wave} 1`, `${wave} 2`]);
    expect(new Set(saved.releases.map((release) => release.slug)).size).toBe(2);
  });

  it("leaves no product a lookup could find when its save fails partway", async () => {
    const input = await research();

    await expect(
      saveProductResearch({ ...input, releasesSourceId: "019a0000-0000-7000-8000-000000000000" }),
    ).rejects.toThrow();

    await expect(
      prisma.product.count({ where: { organization: { domain: input.brand.domain } } }),
    ).resolves.toBe(0);
  });
});

describe(saveProductReleases, () => {
  it("adds what a changed releases page announces to a known product and moves its hash", async () => {
    const input = await research();
    const saved = await saveProductResearch(input);
    const releasesSourceId = input.releasesSourceId;

    const nextRelease = {
      name: `${input.product.name} 17`,
      releasedAt: new Date("2026-11-05"),
      sourceId: releasesSourceId,
      supportEndsAt: null,
      version: "17",
    };

    const reading = {
      provenance,
      releases: [nextRelease],
      releasesHash: "hash-17",
      releasesSourceId,
    };

    const [first, second] = await Promise.all([
      saveProductReleases({ productId: saved.product.id, reading }),
      saveProductReleases({ productId: saved.product.id, reading }),
    ]);

    const added = first.releases.find((release) => release.version === "17");

    expect(first.releases).toHaveLength(3);
    expect([...first.newReleaseIds, ...second.newReleaseIds]).toStrictEqual([added?.id]);
    expect(second.product.releasesHash).toBe("hash-17");
  });
});
