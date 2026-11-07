import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { copyCatalog } from "../../../../packages/db/src/prisma/_sync-content/copy";
import { matchLocalCourses } from "../../../../packages/db/src/prisma/_sync-content/local-courses";
import { CONTENT_TABLES } from "../../../../packages/db/src/prisma/_sync-content/metadata";
import { type TableRows, readRows } from "../../../../packages/db/src/prisma/_sync-content/rows";
import { type SourceCatalog } from "../../../../packages/db/src/prisma/_sync-content/source";

describe(matchLocalCourses, () => {
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

  async function readTable(table: string, ids: string[]): Promise<TableRows> {
    return readRows({
      client: destination,
      params: [ids],
      query: `SELECT * FROM ${table} WHERE id = ANY($1::uuid[]) ORDER BY id`,
    });
  }

  async function sync(tables: Partial<SourceCatalog>) {
    const empty: TableRows = { columns: [], rows: [] };

    const catalog = Object.fromEntries(
      CONTENT_TABLES.map((table) => [table, tables[table] ?? empty]),
    ) as SourceCatalog;

    await copyCatalog({
      catalog: await matchLocalCourses({ catalog, destination }),
      destination,
      organizationId: randomUUID(),
    });
  }

  it("keeps each local pinned course on its own release when the source gave their shared slug the other way round", async () => {
    const brand = await brandFixture();
    const product = await productFixture({ organizationId: brand.id });

    const [release312, release3_1_2] = await Promise.all([
      productReleaseFixture({ normalizedName: "312", productId: product.id, slug: "python-312" }),
      productReleaseFixture({
        normalizedName: "3.1.2",
        productId: product.id,
        slug: "python-312-2",
      }),
    ]);

    const pinned = { isPinned: true, organizationId: brand.id, productId: product.id };

    const [course312, course3_1_2] = await Promise.all([
      courseFixture({ ...pinned, productReleaseId: release312.id, slug: "python-312" }),
      courseFixture({ ...pinned, productReleaseId: release3_1_2.id, slug: "python-312-2" }),
    ]);

    const sourceProductId = randomUUID();

    const sourceReleaseIds = new Map([
      [release312.id, randomUUID()],
      [release3_1_2.id, randomUUID()],
    ]);

    const products = await readTable("products", [product.id]);
    const releases = await readTable("product_releases", [...sourceReleaseIds.keys()]);
    const courses = await readTable("courses", [course312.id, course3_1_2.id]);

    const swappedSlugs = new Map([
      ["python-312", "python-312-2"],
      ["python-312-2", "python-312"],
    ]);

    await sync({
      courses: {
        ...courses,
        rows: courses.rows.map((row) => ({
          ...row,
          id: randomUUID(),
          product_id: sourceProductId,
          product_release_id: sourceReleaseIds.get(row.product_release_id ?? "") ?? null,
          slug: swappedSlugs.get(row.slug ?? "") ?? null,
        })),
      },
      product_releases: {
        ...releases,
        rows: releases.rows.map((row) => ({
          ...row,
          id: sourceReleaseIds.get(row.id ?? "") ?? null,
          product_id: sourceProductId,
        })),
      },
      products: {
        ...products,
        rows: products.rows.map((row) => ({ ...row, id: sourceProductId })),
      },
    });

    const { rows } = await destination.query<{ id: string; product_release_id: string }>(
      "SELECT id, product_release_id FROM courses WHERE organization_id = $1 ORDER BY id",
      [brand.id],
    );

    expect(rows).toStrictEqual(
      [
        { id: course312.id, product_release_id: release312.id },
        { id: course3_1_2.id, product_release_id: release3_1_2.id },
      ].toSorted((first, second) => first.id.localeCompare(second.id)),
    );
  });
});
