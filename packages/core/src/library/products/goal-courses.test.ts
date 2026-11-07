import { randomUUID } from "node:crypto";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockDecision, mockSearchTerms } from "../identity/_test-utils/identity-mocks";
import { findGoalCourse } from "./goal-courses";
import { toNameKey } from "./product-keys";

const provenance = {
  generatedAt: new Date(),
  model: "openai/gpt-6.1-terra",
  promptVersion: "test-v1",
  runId: "test-run",
};

const SHARED = { language: "en", ownerId: null, targetLanguage: null };

async function storedProduct() {
  const brand = await brandFixture();
  const name = `Gizmo ${randomUUID().slice(0, 8)}`;

  const product = await productFixture({
    name,
    normalizedName: toNameKey(name),
    organizationId: brand.id,
  });

  const release = (version: string, releasedAt: string) =>
    productReleaseFixture({
      name: `${name} ${version}`,
      productId: product.id,
      releasedAt: new Date(releasedAt),
    });

  const [older, current] = await Promise.all([
    release("1", "2024-03-01"),
    release("2", "2026-03-01"),
  ]);

  return { brand, current, older, product };
}

function goalProduct({
  courseTitle,
  pinnedReleaseId = null,
  product,
}: {
  courseTitle?: string;
  pinnedReleaseId?: string | null;
  product: { id: string; name: string };
}) {
  return {
    brand: "Test Brand",
    courseTitle: courseTitle ?? product.name,
    id: product.id,
    name: product.name,
    pinnedReleaseId,
  };
}

describe(findGoalCourse, () => {
  it("designates the course titled as the product's as its main course, without an identity call", async () => {
    const { brand, current, product } = await storedProduct();
    const search = mockSearchTerms([]);

    const { course } = await findGoalCourse({
      format: "core",
      product: goalProduct({ product }),
      provenance,
      scope: SHARED,
      title: product.name.toUpperCase(),
    });

    expect(course).toMatchObject({
      isPinned: false,
      organizationId: brand.id,
      productId: product.id,
      productReleaseId: current.id,
      title: product.name,
    });

    expect(search).not.toHaveBeenCalled();
  });

  it("designates the pinned course when the learner named an older release", async () => {
    const { older, product } = await storedProduct();

    const { course } = await findGoalCourse({
      format: "core",
      product: goalProduct({ courseTitle: older.name, pinnedReleaseId: older.id, product }),
      provenance,
      scope: SHARED,
      title: older.name,
    });

    expect(course).toMatchObject({
      isPinned: true,
      productId: product.id,
      productReleaseId: older.id,
      title: older.name,
    });
  });

  it("gives a course titled as another stored product that product's main course", async () => {
    const [{ product }, other] = await Promise.all([storedProduct(), storedProduct()]);

    const { course } = await findGoalCourse({
      format: "core",
      product: goalProduct({ product }),
      provenance,
      scope: SHARED,
      title: other.product.name,
    });

    expect(course).toMatchObject({ isPinned: false, productId: other.product.id });
  });

  it("finds other courses of a product goal as before", async () => {
    const [{ product }] = await Promise.all([storedProduct(), aiOrganizationFixture()]);
    mockSearchTerms([]);
    mockDecision(null);

    const { course } = await findGoalCourse({
      format: "core",
      product: goalProduct({ product }),
      provenance,
      scope: SHARED,
      title: `Typography ${randomUUID().slice(0, 8)}`,
    });

    expect(course.productId).toBeNull();
  });

  it("keeps a private graph's course private, even when titled as the product's", async () => {
    const [{ product }, owner] = await Promise.all([storedProduct(), userFixture()]);
    mockSearchTerms([]);
    mockDecision(null);

    const { course } = await findGoalCourse({
      format: "personalized",
      product: goalProduct({ product }),
      provenance,
      scope: { ...SHARED, ownerId: owner.id },
      title: product.name,
    });

    expect(course).toMatchObject({ productId: null, userId: owner.id, visibility: "private" });
  });
});
