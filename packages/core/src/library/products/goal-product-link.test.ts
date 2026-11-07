import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { findCourseProductLink, findProductCheckedSourceId } from "./goal-product-link";

async function storedProduct() {
  const brand = await brandFixture();
  const product = await productFixture({ organizationId: brand.id });
  const release = await productReleaseFixture({ productId: product.id });
  return { brand, product, release };
}

describe(findCourseProductLink, () => {
  it("links a goal started from a pinned course to its release, and from a main course to none", async () => {
    const [user, { brand, product, release }] = await Promise.all([userFixture(), storedProduct()]);

    const [pinned, main] = await Promise.all(
      [true, false].map((isPinned) =>
        courseFixture({
          isPinned,
          organizationId: brand.id,
          productId: product.id,
          productReleaseId: release.id,
        }),
      ),
    );

    const goals = await Promise.all(
      [pinned, main].map((course) => goalFixture({ primaryCourseId: course?.id, userId: user.id })),
    );

    await expect(
      Promise.all(goals.map((goal) => findCourseProductLink(goal.id))),
    ).resolves.toStrictEqual([
      { productId: product.id, productReleaseId: release.id },
      { productId: product.id, productReleaseId: null },
    ]);
  });

  it("links nothing for a goal without a product course", async () => {
    const user = await userFixture();
    const course = await courseFixture();
    const goal = await goalFixture({ primaryCourseId: course.id, userId: user.id });

    await expect(findCourseProductLink(goal.id)).resolves.toBeNull();
  });
});

describe(findProductCheckedSourceId, () => {
  it("checks the releases page, else the docs, else nothing", async () => {
    const brand = await brandFixture();
    const [releasesPage, docsPage] = await Promise.all([sourceFixture(), sourceFixture()]);

    const [withReleases, withDocs, bare] = await Promise.all([
      productFixture({
        docsSourceId: docsPage.id,
        organizationId: brand.id,
        releasesSourceId: releasesPage.id,
      }),
      productFixture({ docsSourceId: docsPage.id, organizationId: brand.id }),
      productFixture({ organizationId: brand.id }),
    ]);

    await expect(
      Promise.all(
        [withReleases, withDocs, bare].map((product) => findProductCheckedSourceId(product.id)),
      ),
    ).resolves.toStrictEqual([releasesPage.id, docsPage.id, null]);
  });
});
