import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { toNameKey } from "@zoonk/core/library/products/keys";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { normalizeString } from "@zoonk/utils/string";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskResult } from "../_test-utils/recorded-outputs";
import { findGoalCourses } from "./goal-courses";

const provenance = {
  generatedAt: new Date("2026-11-07T00:00:00.000Z"),
  model: "test-model",
  promptVersion: "test-v1",
  runId: "test-run",
};

const sharedGoal = {
  goal: { kind: "learn" as const },
  provenance,
  scope: {
    generalGoal: "Learn product workflows",
    language: "en",
    ownerId: null,
    targetLanguage: null,
  },
  workflowRunId: "test-run",
};

async function storedProduct() {
  const brand = await brandFixture();
  const name = `Gizmo ${randomUUID()}`;

  const product = await productFixture({
    name,
    normalizedName: toNameKey(name),
    organizationId: brand.id,
  });

  return {
    brand: brand.name,
    courseTitle: product.name,
    id: product.id,
    name: product.name,
    organizationId: brand.id,
    pinnedReleaseId: null,
  };
}

describe(findGoalCourses, () => {
  beforeEach(() => {
    vi.mocked(generateSearchTerms).mockRejectedValue(new Error("Search terms unavailable"));
  });

  it.each([false, true])(
    "reuses an existing product course without search terms (pinned: %s)",
    async (pinned) => {
      const product = await storedProduct();

      const release = await productReleaseFixture({
        name: `${product.name} 1`,
        productId: product.id,
      });

      const title = pinned ? release.name : product.name;

      const course = await courseFixture({
        isPinned: pinned,
        normalizedTitle: normalizeString(title),
        organizationId: product.organizationId,
        productId: product.id,
        productReleaseId: release.id,
        title,
      });

      const input = {
        ...sharedGoal,
        courses: [{ key: "main", title: title.toUpperCase() }],
        product: { ...product, courseTitle: title, pinnedReleaseId: pinned ? release.id : null },
      };

      await expect(findGoalCourses(input)).resolves.toStrictEqual({ main: course.id });
      await expect(findGoalCourses(input)).resolves.toStrictEqual({ main: course.id });

      expect(generateSearchTerms).not.toHaveBeenCalled();
      expect(decideLibraryIdentity).not.toHaveBeenCalled();
    },
  );

  it("uses another stored product's main course without search terms", async () => {
    const [product, other] = await Promise.all([storedProduct(), storedProduct()]);

    const course = await courseFixture({
      normalizedTitle: normalizeString(other.name),
      organizationId: other.organizationId,
      productId: other.id,
      title: other.name,
    });

    await expect(
      findGoalCourses({ ...sharedGoal, courses: [{ key: "other", title: other.name }], product }),
    ).resolves.toStrictEqual({ other: course.id });

    expect(generateSearchTerms).not.toHaveBeenCalled();
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
  });

  it("creates one product course when the same run retries concurrently", async () => {
    const product = await storedProduct();
    const input = { ...sharedGoal, courses: [{ key: "main", title: product.name }], product };

    const [first, retry] = await Promise.allSettled([
      findGoalCourses(input),
      findGoalCourses(input),
    ]);

    const courses = await prisma.course.findMany({ where: { productId: product.id } });

    expect(courses).toHaveLength(1);
    expect(first).toStrictEqual({ status: "fulfilled", value: { main: courses[0]?.id } });
    expect(retry).toStrictEqual(first);
    expect(generateSearchTerms).not.toHaveBeenCalled();
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
  });

  it("uses search terms to resolve a non-product course in a product goal", async () => {
    const [product, organization] = await Promise.all([storedProduct(), aiOrganizationFixture()]);
    const title = `zq${randomUUID().replaceAll("-", "")}`;
    const candidateTitle = `zq${randomUUID().replaceAll("-", "")}`;

    const course = await courseFixture({
      normalizedTitle: normalizeString(candidateTitle),
      organizationId: organization.id,
      title: candidateTitle,
    });

    vi.mocked(generateSearchTerms).mockResolvedValue(
      taskResult({ subjects: [{ terms: [candidateTitle] }] }),
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({
      match: { id: course.id, model: "test-model", probability: 0.99 },
      verdicts: [],
    });

    await expect(
      findGoalCourses({ ...sharedGoal, courses: [{ key: "other", title }], product }),
    ).resolves.toStrictEqual({ other: course.id });

    expect(generateSearchTerms).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        subjects: [
          expect.objectContaining({ item: { targetLanguage: null, title }, kind: "course" }),
        ],
      }),
    );

    expect(decideLibraryIdentity).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ candidates: [expect.objectContaining({ id: course.id })] }),
    );
  });
});
