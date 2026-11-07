import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { brandFixture } from "@zoonk/testing/fixtures/products";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { upsertOrganizations } from "../../../../packages/db/src/prisma/_sync-content/upserts";

const COLUMNS = [
  "id",
  "name",
  "slug",
  "kind",
  "domain",
  "website",
  "description",
  "logo",
  "created_at",
];

function sourceBrand({ domain, slug }: { domain: string; slug: string }) {
  return {
    created_at: new Date().toISOString(),
    description: "A company.",
    domain,
    id: randomUUID(),
    kind: "brand",
    logo: null,
    name: "Lumen Works",
    slug,
    website: `https://${domain}/`,
  };
}

describe(upsertOrganizations, () => {
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

  async function sync(brands: ReturnType<typeof sourceBrand>[]) {
    const ai = await prisma.organization.findUniqueOrThrow({ where: { slug: "ai" } });

    const products = {
      columns: ["organization_id"],
      rows: brands.map((brand) => ({ organization_id: brand.id })),
    };

    const catalog = await upsertOrganizations({
      catalog: {
        courses: { columns: ["organization_id"], rows: [] },
        organizations: { columns: COLUMNS, rows: brands },
        products,
      } as never,
      destination,
      organizationId: ai.id,
      sourceOrganizationId: ai.id,
    });

    return catalog.products.rows.map((row) => row.organization_id);
  }

  async function readBrand(id: string) {
    const { rows } = await destination.query<{ domain: string | null; slug: string }>(
      "SELECT slug, domain FROM organizations WHERE id = $1",
      [id],
    );

    return rows[0];
  }

  it("keeps a local brand researched under another slug, matched by its domain", async () => {
    const key = randomUUID().slice(0, 8);
    const local = await brandFixture({ domain: `lumen-${key}.example`, slug: `lumen-${key}-2` });

    await expect(
      sync([sourceBrand({ domain: `lumen-${key}.example`, slug: `lumen-${key}` })]),
    ).resolves.toStrictEqual([local.id]);

    await expect(readBrand(local.id)).resolves.toStrictEqual({
      domain: `lumen-${key}.example`,
      slug: `lumen-${key}-2`,
    });
  });

  it("falls back to the slug for a local brand with no domain", async () => {
    const key = randomUUID().slice(0, 8);
    const local = await brandFixture({ domain: null, slug: `lumen-${key}` });

    await expect(
      sync([sourceBrand({ domain: `lumen-${key}.example`, slug: `lumen-${key}` })]),
    ).resolves.toStrictEqual([local.id]);

    await expect(readBrand(local.id)).resolves.toMatchObject({ domain: `lumen-${key}.example` });
  });

  it("keeps a local brand with another domain under the slug, syncing the source brand apart", async () => {
    const key = randomUUID().slice(0, 8);
    const slug = `orbit-${key}`;
    const local = await brandFixture({ domain: `orbit-tools-${key}.example`, slug });
    const incoming = sourceBrand({ domain: `orbit-foods-${key}.example`, slug });

    await expect(sync([incoming])).resolves.toStrictEqual([incoming.id]);

    await expect(readBrand(local.id)).resolves.toStrictEqual({
      domain: `orbit-tools-${key}.example`,
      slug: `orbit-${key}`,
    });

    await expect(readBrand(incoming.id)).resolves.toStrictEqual({
      domain: `orbit-foods-${key}.example`,
      slug: `orbit-${key}-2`,
    });
  });
});
