import { randomUUID } from "node:crypto";
import { type Organization, type Product, type ProductRelease, prisma } from "@zoonk/db";
import { type FixtureAttrs, fixtureProvenance } from "./_utils/fixture-attrs";
import { organizationFixture } from "./orgs";

export async function brandFixture(attrs?: Partial<Organization>) {
  const key = randomUUID();

  return organizationFixture({
    description: "A test brand that makes test products.",
    domain: `brand-${key}.test`,
    name: "Test Brand",
    slug: `test-brand-${key}`,
    website: `https://brand-${key}.test/`,
    ...attrs,
  });
}

export async function productFixture(
  attrs: FixtureAttrs<Product> & Pick<Product, "organizationId">,
) {
  const key = randomUUID();

  return prisma.product.create({
    data: {
      description: "A test product people learn to use.",
      name: "Test Product",
      normalizedName: `testproduct${key.replaceAll("-", "")}`,
      slug: `test-product-${key}`,
      website: `https://product-${key}.test/`,
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}

export async function productReleaseFixture(
  attrs: FixtureAttrs<ProductRelease> & Pick<ProductRelease, "productId">,
) {
  const key = randomUUID();

  return prisma.productRelease.create({
    data: {
      name: "Test Product 1",
      normalizedName: `testproduct1${key.replaceAll("-", "")}`,
      slug: `test-product-1-${key}`,
      ...fixtureProvenance(),
      ...attrs,
    },
  });
}
