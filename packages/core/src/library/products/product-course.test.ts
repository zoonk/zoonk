import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { describe, expect, it } from "vitest";
import { findOrCreateProductCourse } from "./product-course";

const NOW = new Date("2026-11-06T12:00:00.000Z");

const provenance = {
  generatedAt: new Date(),
  model: "openai/gpt-6.1-terra",
  promptVersion: "test-v1",
  runId: "test-run",
};

async function storedProduct() {
  const brand = await brandFixture();
  const name = `Widget ${randomUUID().slice(0, 8)} Pro`;
  const product = await productFixture({ name, organizationId: brand.id });

  const release = (version: string, releasedAt: string) =>
    productReleaseFixture({
      name: `${name} ${version}`,
      productId: product.id,
      releasedAt: new Date(releasedAt),
    });

  const [older, current, announced] = await Promise.all([
    release("15", "2025-10-21"),
    release("16", "2026-10-21"),
    release("17", "2027-01-15"),
  ]);

  return { announced, brand, current, older, product };
}

function request(attrs: { language?: string; pinnedReleaseId?: string | null; productId: string }) {
  return { language: "en", now: NOW, pinnedReleaseId: null, provenance, ...attrs };
}

describe(findOrCreateProductCourse, () => {
  it("makes the main course in the brand's organization, titled with the product and teaching its current release", async () => {
    const { brand, current, product } = await storedProduct();

    const made = await findOrCreateProductCourse(
      request({ language: "pt", productId: product.id }),
    );

    expect(made.created).toBe(true);

    expect(made.course).toMatchObject({
      isPinned: false,
      isPublished: false,
      language: "pt",
      organizationId: brand.id,
      productId: product.id,
      productReleaseId: current.id,
      title: product.name,
      userId: null,
      visibility: "public",
    });

    expect(made.course.slug.endsWith("-pt")).toBe(true);
  });

  it("finds the main course again whatever release it teaches now", async () => {
    const { announced, product } = await storedProduct();
    const made = await findOrCreateProductCourse(request({ productId: product.id }));

    await prisma.course.update({
      data: { productReleaseId: announced.id },
      where: { id: made.course.id },
    });

    const found = await findOrCreateProductCourse(request({ productId: product.id }));

    expect(found).toMatchObject({ course: { id: made.course.id }, created: false });
  });

  it("makes a pinned course per named release, titled with the release, apart from the main course", async () => {
    const { older, product } = await storedProduct();

    const [main, pinned, pinnedAgain] = await Promise.all([
      findOrCreateProductCourse(request({ productId: product.id })),
      findOrCreateProductCourse(request({ pinnedReleaseId: older.id, productId: product.id })),
      findOrCreateProductCourse(request({ pinnedReleaseId: older.id, productId: product.id })),
    ]);

    expect(pinned.course).toMatchObject({
      isPinned: true,
      productReleaseId: older.id,
      title: older.name,
    });

    expect(pinnedAgain.course.id).toBe(pinned.course.id);
    expect(pinned.course.id).not.toBe(main.course.id);
    expect(pinned.course.slug).not.toBe(main.course.slug);
  });

  it("keeps one main course per language", async () => {
    const { product } = await storedProduct();

    const [english, portuguese] = await Promise.all([
      findOrCreateProductCourse(request({ language: "en", productId: product.id })),
      findOrCreateProductCourse(request({ language: "pt", productId: product.id })),
    ]);

    expect(english.course.id).not.toBe(portuguese.course.id);
  });

  it("makes one main course when two goals ask for it at once", async () => {
    const { product } = await storedProduct();

    const [first, second] = await Promise.all([
      findOrCreateProductCourse(request({ productId: product.id })),
      findOrCreateProductCourse(request({ productId: product.id })),
    ]);

    expect(second.course.id).toBe(first.course.id);
    expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
  });

  it("gives a product with no release out yet a main course that teaches none", async () => {
    const brand = await brandFixture();
    const product = await productFixture({ organizationId: brand.id });
    await productReleaseFixture({ productId: product.id, releasedAt: new Date("2027-01-15") });

    const { course } = await findOrCreateProductCourse(request({ productId: product.id }));

    expect(course).toMatchObject({ isPinned: false, productReleaseId: null, title: product.name });
  });

  it("takes a slug free in the brand's organization", async () => {
    const { brand, product } = await storedProduct();

    const taken = await courseFixture({
      organizationId: brand.id,
      slug: product.name.toLowerCase().replaceAll(" ", "-"),
    });

    const { course } = await findOrCreateProductCourse(request({ productId: product.id }));

    expect(course.slug).not.toBe(taken.slug);
    expect(course.slug.startsWith(taken.slug)).toBe(true);
  });

  it("refuses to pin a release of another product", async () => {
    const [first, second] = await Promise.all([storedProduct(), storedProduct()]);

    await expect(
      findOrCreateProductCourse(
        request({ pinnedReleaseId: second.older.id, productId: first.product.id }),
      ),
    ).rejects.toThrow();
  });
});
