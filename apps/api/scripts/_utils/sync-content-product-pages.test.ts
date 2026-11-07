import { randomUUID } from "node:crypto";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { copyCatalog } from "../../../../packages/db/src/prisma/_sync-content/copy";
import { CONTENT_TABLES } from "../../../../packages/db/src/prisma/_sync-content/metadata";
import { type TableRows, readRows } from "../../../../packages/db/src/prisma/_sync-content/rows";
import { type SourceCatalog } from "../../../../packages/db/src/prisma/_sync-content/source";

describe(copyCatalog, () => {
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

  async function readTable(table: string, id: string): Promise<TableRows> {
    return readRows({
      client: destination,
      params: [id],
      query: `SELECT * FROM ${table} WHERE id = $1`,
    });
  }

  it("keeps a local product's page links when the source researched the same pages under other ids", async () => {
    const brand = await brandFixture();

    const [website, docs, releasesPage, notes] = await Promise.all([
      sourceFixture(),
      sourceFixture(),
      sourceFixture(),
      sourceFixture(),
    ]);

    const product = await productFixture({
      docsSourceId: docs.id,
      organizationId: brand.id,
      releasesSourceId: releasesPage.id,
      websiteSourceId: website.id,
    });

    const release = await productReleaseFixture({ productId: product.id, sourceId: notes.id });

    const products = await readTable("products", product.id);
    const releases = await readTable("product_releases", release.id);
    const sourceProductId = randomUUID();
    const empty: TableRows = { columns: [], rows: [] };

    const catalog = Object.fromEntries(
      CONTENT_TABLES.map((table) => [table, empty]),
    ) as SourceCatalog;

    await copyCatalog({
      catalog: {
        ...catalog,
        product_releases: {
          ...releases,
          rows: releases.rows.map((row) => ({
            ...row,
            id: randomUUID(),
            product_id: sourceProductId,
            source_id: randomUUID(),
          })),
        },
        products: {
          ...products,
          rows: products.rows.map((row) => ({
            ...row,
            docs_source_id: randomUUID(),
            id: sourceProductId,
            releases_source_id: randomUUID(),
            website_source_id: randomUUID(),
          })),
        },
      },
      destination,
      organizationId: randomUUID(),
    });

    const pages = await destination.query(
      `SELECT website_source_id, docs_source_id, releases_source_id, release.source_id
         FROM products JOIN product_releases release ON release.product_id = products.id
        WHERE products.id = $1`,
      [product.id],
    );

    expect(pages.rows).toStrictEqual([
      {
        docs_source_id: docs.id,
        releases_source_id: releasesPage.id,
        source_id: notes.id,
        website_source_id: website.id,
      },
    ]);
  });
});
