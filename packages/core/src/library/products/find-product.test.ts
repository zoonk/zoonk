import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { type ProductHints, findProduct } from "./find-product";
import { toNameKey } from "./product-keys";

const NOW = new Date("2026-11-06T12:00:00.000Z");

function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)} Pro`;
}

async function storedProduct({ aliases = [], name }: { aliases?: string[]; name: string }) {
  const brand = await brandFixture({ name: uniqueName("Brand") });

  const product = await productFixture({
    aliases: aliases.map((alias) => toNameKey(alias)),
    name,
    normalizedName: toNameKey(name),
    organizationId: brand.id,
  });

  return { brand, product };
}

function hints(attrs: Partial<ProductHints> & Pick<ProductHints, "name">): ProductHints {
  return { brand: "", officialDomains: [], release: null, ...attrs };
}

describe(findProduct, () => {
  it("finds a product under the brand the hints name by domain or by name, however the name is written", async () => {
    const name = uniqueName("Widget.js");
    const { brand, product } = await storedProduct({ name });
    const spaced = name.replace(".", " ");

    const [byDomain, byBrandName] = await Promise.all([
      findProduct({ hints: hints({ name: spaced, officialDomains: [`docs.${brand.domain}`] }) }),
      findProduct({ hints: hints({ brand: brand.name.toUpperCase(), name: spaced }) }),
    ]);

    expect(byDomain?.product.id).toBe(product.id);
    expect(byBrandName?.product.id).toBe(product.id);
  });

  it("finds a product by an alias learners use", async () => {
    const alias = uniqueName("WX");

    const { brand, product } = await storedProduct({
      aliases: [alias],
      name: uniqueName("Widget"),
    });

    const found = await findProduct({ hints: hints({ brand: brand.name, name: alias }) });

    expect(found?.product.id).toBe(product.id);
  });

  it("never links a namesake under a brand the hints don't name", async () => {
    const name = uniqueName("Connect");
    await storedProduct({ name });

    const found = await findProduct({
      hints: hints({ brand: "Another Company", name, officialDomains: ["another-company.test"] }),
    });

    expect(found).toBeNull();
  });

  it("finds nothing when the hints fit two brands' products", async () => {
    const name = uniqueName("Connect");
    const first = await storedProduct({ name });
    const second = await storedProduct({ name });

    const found = await findProduct({
      hints: hints({ brand: second.brand.name, name, officialDomains: [first.brand.domain ?? ""] }),
    });

    expect(found).toBeNull();
  });

  it("finds the release the learner names by its name or its version", async () => {
    const { brand, product } = await storedProduct({ name: uniqueName("Widget") });

    const [older] = await Promise.all([
      productReleaseFixture({
        name: `${product.name} 15`,
        normalizedName: toNameKey(`${product.name} 15`),
        productId: product.id,
        releasedAt: new Date("2025-10-21"),
        version: "15",
      }),
      productReleaseFixture({
        name: `${product.name} 16`,
        normalizedName: toNameKey(`${product.name} 16`),
        productId: product.id,
        releasedAt: new Date("2026-10-21"),
        version: "16",
      }),
    ]);

    const find = (release: string | null) =>
      findProduct({ hints: hints({ brand: brand.name, name: product.name, release }), now: NOW });

    const [byName, byVersion, byPrefixedVersion, byProductAndVersion, unnamed, unknown] =
      await Promise.all([
        find(`${product.name.toLowerCase()} 15`),
        find("15"),
        find("v15"),
        find(`${product.name}15`),
        find(null),
        find("14"),
      ]);

    expect(
      [byName, byVersion, byPrefixedVersion, byProductAndVersion].map(
        (found) => found?.namedRelease?.id,
      ),
    ).toStrictEqual([older.id, older.id, older.id, older.id]);

    expect(unnamed?.namedRelease).toBeNull();
    expect(unknown?.namedRelease).toBeNull();
  });

  it("never takes a version for another whose numbers break in other places", async () => {
    const { brand, product } = await storedProduct({ name: uniqueName("Snake") });

    const release = await productReleaseFixture({
      name: `${product.name} 3.12`,
      normalizedName: toNameKey(`${product.name} 3.12`),
      productId: product.id,
      version: "3.12",
    });

    const find = (hint: string) =>
      findProduct({ hints: hints({ brand: brand.name, name: product.name, release: hint }) });

    const [other, same, spaced] = await Promise.all([find("3.1.2"), find("3.12"), find("3 12")]);

    expect(other?.namedRelease).toBeNull();
    expect(same?.namedRelease?.id).toBe(release.id);
    expect(spaced?.namedRelease?.id).toBe(release.id);
  });

  it("finds a release named with its product, even when the product's name starts like a version", async () => {
    const { brand, product } = await storedProduct({ name: `V8 ${uniqueName("Engine")}` });

    const release = await productReleaseFixture({
      name: "Release 13.0",
      normalizedName: toNameKey("Release 13.0"),
      productId: product.id,
      version: "13.0",
    });

    const found = await findProduct({
      hints: hints({ brand: brand.name, name: product.name, release: `${product.name} 13.0` }),
    });

    expect(found?.namedRelease?.id).toBe(release.id);
  });

  it("counts a product as fresh only while its releases page was fetched this week and its releases were read from it", async () => {
    const { brand, product } = await storedProduct({ name: uniqueName("Widget") });
    const lookup = { brand: brand.name, name: product.name };

    const withoutPage = await findProduct({ hints: hints(lookup), now: NOW });

    const [recent, old] = await Promise.all([
      sourceFixture({ contentHash: "hash-read", fetchedAt: new Date(NOW.getTime() - MS_PER_DAY) }),
      sourceFixture({
        contentHash: "hash-read",
        fetchedAt: new Date(NOW.getTime() - 8 * MS_PER_DAY),
      }),
    ]);

    const freshness = async (releasesSourceId: string, releasesHash: string | null) => {
      await prisma.product.update({
        data: { releasesHash, releasesSourceId },
        where: { id: product.id },
      });

      const found = await findProduct({ hints: hints(lookup), now: NOW });
      return found?.isFresh;
    };

    expect(withoutPage?.isFresh).toBe(true);
    await expect(freshness(recent.id, "hash-read")).resolves.toBe(true);
    await expect(freshness(recent.id, "hash-before")).resolves.toBe(false);
    await expect(freshness(old.id, "hash-read")).resolves.toBe(false);
  });
});
