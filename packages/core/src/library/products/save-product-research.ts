import "server-only";
import {
  type Organization,
  type Product,
  type ProductRelease,
  type TransactionClient,
  prisma,
  sql,
} from "@zoonk/db";
import { pickAvailableSlug, toSlug } from "@zoonk/utils/string";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  toProvenanceData,
} from "../_utils/library-rows";
import { toNameKey } from "./product-keys";

const BRAND_LOCK_NAMESPACE = 51_884;

type ResearchedBrand = { description: string; domain: string; name: string; website: string };

type ResearchedProduct = {
  aliases: readonly string[];
  description: string;
  docsSourceId: string | null;
  name: string;
  website: string;
  websiteSourceId: string | null;
};

type ResearchedRelease = {
  name: string;
  releasedAt: Date | null;
  sourceId: string | null;
  supportEndsAt: Date | null;
  version: string | null;
};

type ReleasesReading = {
  provenance: LibraryProvenance;
  releases: readonly ResearchedRelease[];
  /** The hash of the releases page the releases were read from. */
  releasesHash: string | null;
  releasesSourceId: string | null;
};

export type ProductResearch = ReleasesReading & {
  brand: ResearchedBrand;
  product: ResearchedProduct;
};

type SavedReleases = {
  /** Releases this save stored for the first time. */
  newReleaseIds: string[];
  product: Product;
  releases: ProductRelease[];
};

async function lockBrandProducts(tx: TransactionClient, organizationId: string): Promise<void> {
  await tx.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${BRAND_LOCK_NAMESPACE}::int, hashtext(${organizationId}))::text`,
  );
}

async function pickOrganizationSlug(brand: ResearchedBrand): Promise<string> {
  const base = toSlug(brand.name) || toSlug(brand.domain);

  const taken = await prisma.organization.findMany({
    select: { slug: true },
    where: { slug: { startsWith: base } },
  });

  return pickAvailableSlug({ base, taken: taken.map((organization) => organization.slug) });
}

async function saveBrand(brand: ResearchedBrand): Promise<Organization> {
  const { row } = await createOrFindByIdentity({
    create: async () =>
      prisma.organization.create({
        data: {
          description: brand.description,
          domain: brand.domain,
          kind: "brand",
          name: brand.name,
          slug: await pickOrganizationSlug(brand),
          website: brand.website,
        },
      }),
    findExisting: () => prisma.organization.findUnique({ where: { domain: brand.domain } }),
  });

  return row;
}

function toAliasKeys({ aliases, nameKey }: { aliases: readonly string[]; nameKey: string }) {
  return [...new Set(aliases.map((alias) => toNameKey(alias)))].filter(
    (alias) => alias !== "" && alias !== nameKey,
  );
}

function pickSlug({ name, taken }: { name: string; taken: readonly string[] }): string {
  return pickAvailableSlug({ base: toSlug(name) || toNameKey(name), taken });
}

async function createProduct({
  normalizedName,
  organizationId,
  research,
  tx,
}: {
  normalizedName: string;
  organizationId: string;
  research: ProductResearch;
  tx: TransactionClient;
}): Promise<Product> {
  const { product } = research;
  const taken = await tx.product.findMany({ select: { slug: true }, where: { organizationId } });

  return tx.product.create({
    data: {
      ...toProvenanceData(research.provenance),
      aliases: toAliasKeys({ aliases: product.aliases, nameKey: normalizedName }),
      description: product.description,
      docsSourceId: product.docsSourceId,
      name: product.name,
      normalizedName,
      organizationId,
      slug: pickSlug({ name: product.name, taken: taken.map((row) => row.slug) }),
      website: product.website,
      websiteSourceId: product.websiteSourceId,
    },
  });
}

/** A later reading adds aliases and fills in what the first left out; it never renames. */
async function saveProduct({
  organizationId,
  research,
  tx,
}: {
  organizationId: string;
  research: ProductResearch;
  tx: TransactionClient;
}): Promise<Product> {
  const normalizedName = toNameKey(research.product.name);

  const existing = await tx.product.findUnique({
    where: { organizationName: { normalizedName, organizationId } },
  });

  if (!existing) {
    return createProduct({ normalizedName, organizationId, research, tx });
  }

  const aliases = toAliasKeys({ aliases: research.product.aliases, nameKey: normalizedName });

  return tx.product.update({
    data: {
      aliases: [...new Set([...existing.aliases, ...aliases])],
      docsSourceId: existing.docsSourceId ?? research.product.docsSourceId,
      websiteSourceId: existing.websiteSourceId ?? research.product.websiteSourceId,
    },
    where: { id: existing.id },
  });
}

type ReleaseRow = ResearchedRelease & { normalizedName: string };

function toReleaseRows(releases: readonly ResearchedRelease[]): ReleaseRow[] {
  const rows = releases.flatMap((release) => {
    const normalizedName = toNameKey(release.name);
    return normalizedName ? [{ ...release, normalizedName }] : [];
  });

  return [...new Map(rows.map((row) => [row.normalizedName, row])).values()];
}

/** A later reading fills in or corrects what it states; what it leaves out stays as saved. */
function toStatedFields(release: ReleaseRow) {
  return Object.fromEntries(
    Object.entries({
      releasedAt: release.releasedAt,
      sourceId: release.sourceId,
      supportEndsAt: release.supportEndsAt,
      version: release.version,
    }).filter(([, value]) => value !== null),
  );
}

function assignSlugs({
  releases,
  taken,
}: {
  releases: readonly ReleaseRow[];
  taken: readonly string[];
}): (ReleaseRow & { slug: string })[] {
  const used = new Set(taken);

  return releases.map((release) => {
    const slug = pickSlug({ name: release.name, taken: [...used] });
    used.add(slug);
    return { ...release, slug };
  });
}

async function updateStatedReleases({
  known,
  productId,
  releases,
  tx,
}: {
  known: ReadonlySet<string>;
  productId: string;
  releases: readonly ReleaseRow[];
  tx: TransactionClient;
}): Promise<void> {
  for (const release of releases.filter((row) => known.has(row.normalizedName))) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    await tx.productRelease.updateMany({
      data: toStatedFields(release),
      where: { normalizedName: release.normalizedName, productId },
    });
  }
}

async function saveReleases({
  productId,
  reading,
  tx,
}: {
  productId: string;
  reading: ReleasesReading;
  tx: TransactionClient;
}): Promise<string[]> {
  const releases = toReleaseRows(reading.releases);

  const existing = await tx.productRelease.findMany({
    select: { normalizedName: true, slug: true },
    where: { productId },
  });

  const known = new Set(existing.map((release) => release.normalizedName));

  const fresh = assignSlugs({
    releases: releases.filter((release) => !known.has(release.normalizedName)),
    taken: existing.map((release) => release.slug),
  });

  await updateStatedReleases({ known, productId, releases, tx });

  const created = await tx.productRelease.createManyAndReturn({
    data: fresh.map((release) => ({
      ...toProvenanceData(reading.provenance),
      name: release.name,
      normalizedName: release.normalizedName,
      productId,
      releasedAt: release.releasedAt,
      slug: release.slug,
      sourceId: release.sourceId,
      supportEndsAt: release.supportEndsAt,
      version: release.version,
    })),
    select: { id: true },
  });

  return created.map((release) => release.id);
}

/** A product keeps the first releases page it was given; the hash moves only with that page. */
async function saveReleasesPage({
  productId,
  reading,
  tx,
}: {
  productId: string;
  reading: ReleasesReading;
  tx: TransactionClient;
}): Promise<void> {
  const { releasesHash, releasesSourceId } = reading;

  if (!releasesSourceId) {
    return;
  }

  await tx.product.updateMany({
    data: { releasesSourceId },
    where: { id: productId, releasesSourceId: null },
  });

  if (releasesHash) {
    await tx.product.updateMany({
      data: { releasesHash },
      where: { id: productId, releasesSourceId },
    });
  }
}

async function finishReleases({
  productId,
  reading,
  tx,
}: {
  productId: string;
  reading: ReleasesReading;
  tx: TransactionClient;
}): Promise<SavedReleases> {
  const newReleaseIds = await saveReleases({ productId, reading, tx });
  await saveReleasesPage({ productId, reading, tx });

  const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });

  const releases = await tx.productRelease.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { productId },
  });

  return { newReleaseIds, product, releases };
}

/**
 * Internal workflow bridge for research. The brand is found by its domain; the product, its
 * releases and its pages commit together under the brand's lock, so concurrent saves converge on the
 * same rows and a lookup never sees a product whose save failed partway. The first save's names and
 * descriptions stay.
 */
export async function saveProductResearch(
  research: ProductResearch,
): Promise<SavedReleases & { organization: Organization }> {
  const organization = await saveBrand(research.brand);

  const saved = await prisma.$transaction(async (tx) => {
    await lockBrandProducts(tx, organization.id);
    const product = await saveProduct({ organizationId: organization.id, research, tx });
    return finishReleases({ productId: product.id, reading: research, tx });
  });

  return { ...saved, organization };
}

/** Internal workflow bridge for a known product's releases page, read again after it changed. */
export async function saveProductReleases({
  productId,
  reading,
}: {
  productId: string;
  reading: ReleasesReading;
}): Promise<SavedReleases> {
  const { organizationId } = await prisma.product.findUniqueOrThrow({
    select: { organizationId: true },
    where: { id: productId },
  });

  return prisma.$transaction(async (tx) => {
    await lockBrandProducts(tx, organizationId);
    return finishReleases({ productId, reading, tx });
  });
}
