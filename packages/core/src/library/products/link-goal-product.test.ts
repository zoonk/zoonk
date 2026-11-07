import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { linkGoalToProduct } from "./link-goal-product";

async function storedProduct() {
  const brand = await brandFixture();
  const product = await productFixture({ organizationId: brand.id });
  const release = await productReleaseFixture({ productId: product.id });
  return { product, release };
}

describe(linkGoalToProduct, () => {
  it("links each of a learner's goals to the product and release, recording the decision", async () => {
    const [user, { product, release }] = await Promise.all([userFixture(), storedProduct()]);

    const goals = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const link = { productId: product.id, productReleaseId: release.id };

    await expect(
      Promise.all(goals.map((goal) => linkGoalToProduct({ goalId: goal.id, link }))),
    ).resolves.toStrictEqual([true, true]);

    const linked = await prisma.goal.findMany({
      where: { id: { in: goals.map((goal) => goal.id) } },
    });

    expect(linked).toHaveLength(2);

    expect(
      linked.every(
        (goal) =>
          goal.productId === product.id &&
          goal.productReleaseId === release.id &&
          goal.productCheckedAt instanceof Date,
      ),
    ).toBe(true);
  });

  it("records a decision with no product, keeping a product an earlier research linked", async () => {
    const [user, { product }] = await Promise.all([userFixture(), storedProduct()]);

    const [unlinked, linked] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ productId: product.id, userId: user.id }),
    ]);

    await Promise.all([
      linkGoalToProduct({ goalId: unlinked.id, link: null }),
      linkGoalToProduct({ goalId: linked.id, link: null }),
    ]);

    const goals = await prisma.goal.findMany({ where: { id: { in: [unlinked.id, linked.id] } } });

    expect(goals.every((goal) => goal.productCheckedAt instanceof Date)).toBe(true);
    expect(goals.find((goal) => goal.id === unlinked.id)?.productId).toBeNull();
    expect(goals.find((goal) => goal.id === linked.id)?.productId).toBe(product.id);
  });

  it("does nothing for a goal that is gone", async () => {
    await expect(
      linkGoalToProduct({ goalId: "019a0000-0000-7000-8000-000000000000", link: null }),
    ).resolves.toBe(false);
  });
});
