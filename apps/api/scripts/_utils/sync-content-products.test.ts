import { randomUUID } from "node:crypto";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { upsertProducts } from "../../../../packages/db/src/prisma/_sync-content/upserts";

const PROVENANCE = { model: "test/model", prompt_version: "test-v1", run_id: "test-run" };

function sourceProduct({
  normalizedName,
  organizationId,
  slug,
}: {
  normalizedName: string;
  organizationId: string;
  slug: string;
}) {
  return {
    ...PROVENANCE,
    description: "A product.",
    id: randomUUID(),
    name: "Python",
    normalized_name: normalizedName,
    organization_id: organizationId,
    slug,
    website: "https://python.example/",
  };
}

function sourceRelease({
  normalizedName,
  productId,
  slug,
}: {
  normalizedName: string;
  productId: string;
  slug: string;
}) {
  return {
    ...PROVENANCE,
    id: randomUUID(),
    name: normalizedName,
    normalized_name: normalizedName,
    product_id: productId,
    slug,
  };
}

function toRows<Row extends Record<string, string>>(rows: Row[]) {
  return { columns: Object.keys(rows[0] ?? {}), rows };
}

describe(upsertProducts, () => {
  const destination = new Client({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => {
    await destination.connect();
  });

  beforeEach(async () => {
    await destination.query("BEGIN");
  });

  afterEach(async () => {
    await destination.query("ROLLBACK");
  });

  afterAll(async () => {
    await destination.end();
  });

  async function readSlugs(table: "product_releases" | "products", parent: string) {
    const column = table === "products" ? "organization_id" : "product_id";

    const { rows } = await destination.query<{ normalized_name: string; slug: string }>(
      `SELECT normalized_name, slug FROM ${table} WHERE ${column} = $1 ORDER BY normalized_name COLLATE "C"`,
      [parent],
    );

    return rows;
  }

  it("keeps each local release's slug when the source gave their shared base slug the other way round", async () => {
    const brand = await brandFixture();
    const key = randomUUID().slice(0, 8);

    const local = await productFixture({
      normalizedName: `python${key}`,
      organizationId: brand.id,
    });

    await productReleaseFixture({ normalizedName: "312", productId: local.id, slug: "python-312" });

    await productReleaseFixture({
      normalizedName: "3.1.2",
      productId: local.id,
      slug: "python-312-2",
    });

    const product = sourceProduct({
      normalizedName: `python${key}`,
      organizationId: brand.id,
      slug: local.slug,
    });

    await upsertProducts({
      destination,
      products: toRows([product]),
      releases: toRows([
        sourceRelease({ normalizedName: "3.1.2", productId: product.id, slug: "python-312" }),
        sourceRelease({ normalizedName: "312", productId: product.id, slug: "python-312-2" }),
      ]),
    });

    await expect(readSlugs("product_releases", local.id)).resolves.toStrictEqual([
      { normalized_name: "3.1.2", slug: "python-312-2" },
      { normalized_name: "312", slug: "python-312" },
    ]);
  });

  it("gives a new product and a new release a free slug when a local one under another name holds theirs", async () => {
    const brand = await brandFixture();

    const local = await productFixture({
      normalizedName: "c",
      organizationId: brand.id,
      slug: "c",
    });

    await productReleaseFixture({ normalizedName: "11", productId: local.id, slug: "c-11" });

    const newProduct = sourceProduct({
      normalizedName: "c++",
      organizationId: brand.id,
      slug: "c",
    });

    const sameProduct = sourceProduct({
      normalizedName: "c",
      organizationId: brand.id,
      slug: "c-2",
    });

    const { productIds, releaseIds } = await upsertProducts({
      destination,
      products: toRows([newProduct, sameProduct]),
      releases: toRows([
        sourceRelease({ normalizedName: "1.1", productId: sameProduct.id, slug: "c-11" }),
      ]),
    });

    expect(productIds.get(sameProduct.id)).toBe(local.id);
    expect(releaseIds.size).toBe(1);

    await expect(readSlugs("products", brand.id)).resolves.toStrictEqual([
      { normalized_name: "c", slug: "c" },
      { normalized_name: "c++", slug: "c-3" },
    ]);

    await expect(readSlugs("product_releases", local.id)).resolves.toStrictEqual([
      { normalized_name: "1.1", slug: "c-11-2" },
      { normalized_name: "11", slug: "c-11" },
    ]);
  });
});
