import { type Client } from "pg";
import {
  type TableRows,
  getColumnValues,
  getRowKey,
  getUpsertClause,
  insertRows,
  mapColumn,
  readRows,
} from "./rows";
import { type SourceCatalog } from "./source";

export type IdMap = ReadonlyMap<string, string>;

async function upsertRows({
  conflict,
  data,
  destination,
  keep,
  table,
}: {
  conflict: string[];
  data: TableRows;
  destination: Client;
  keep: string[];
  table: string;
}): Promise<IdMap> {
  const returned = await insertRows({
    data,
    destination,
    suffix: getUpsertClause({
      columns: data.columns,
      conflict,
      keep: ["id", ...keep],
      returning: ["id", ...conflict],
    }),
    table,
  });

  const destinationIds = new Map(returned.map((row) => [getRowKey(row, conflict), row.id]));

  return new Map(
    data.rows.flatMap((row) => {
      const destinationId = destinationIds.get(getRowKey(row, conflict));
      return row.id && destinationId ? [[row.id, destinationId] as const] : [];
    }),
  );
}

function withOrganization({
  data,
  organizationId,
}: {
  data: TableRows;
  organizationId: string;
}): TableRows {
  return { ...data, rows: data.rows.map((row) => ({ ...row, organization_id: organizationId })) };
}

/**
 * A brand is its domain: research may have saved the same brand here under another slug. Each source
 * brand takes the id and slug of the local brand with its domain, else of the one with its slug.
 */
async function matchLocalBrands({
  data,
  destination,
}: {
  data: TableRows;
  destination: Client;
}): Promise<TableRows> {
  const local = await readRows({
    client: destination,
    params: [getColumnValues(data, "domain"), getColumnValues(data, "slug")],
    query: "SELECT id, slug, domain FROM organizations WHERE domain = ANY($1) OR slug = ANY($2)",
  });

  const byDomain = new Map(local.rows.map((row) => [row.domain, row]));
  const bySlug = new Map(local.rows.map((row) => [row.slug, row]));

  return {
    ...data,
    rows: data.rows.map((row) => {
      const match = (row.domain && byDomain.get(row.domain)) || bySlug.get(row.slug);
      return match ? { ...row, id: match.id ?? null, slug: match.slug ?? null } : row;
    }),
  };
}

export async function upsertOrganizations({
  catalog,
  destination,
  organizationId,
  sourceOrganizationId,
}: {
  catalog: SourceCatalog;
  destination: Client;
  organizationId: string;
  sourceOrganizationId: string;
}): Promise<SourceCatalog> {
  const brands = await matchLocalBrands({ data: catalog.organizations, destination });

  await upsertRows({
    conflict: ["id"],
    data: brands,
    destination,
    keep: ["created_at"],
    table: "organizations",
  });

  const organizationIds = new Map([
    [sourceOrganizationId, organizationId],
    ...catalog.organizations.rows.map((row, index) => [row.id, brands.rows[index]?.id] as const),
  ]);

  const remap = (data: TableRows) =>
    mapColumn({ column: "organization_id", data, map: (id) => organizationIds.get(id) ?? null });

  return { ...catalog, courses: remap(catalog.courses), products: remap(catalog.products) };
}

export async function upsertProducts({
  destination,
  products,
  releases,
}: {
  destination: Client;
  products: TableRows;
  releases: TableRows;
}): Promise<{ productIds: IdMap; releaseIds: IdMap }> {
  const productIds = await upsertRows({
    conflict: ["organization_id", "normalized_name"],
    data: products,
    destination,
    keep: ["created_at"],
    table: "products",
  });

  const releaseIds = await upsertRows({
    conflict: ["product_id", "normalized_name"],
    data: mapColumn({
      column: "product_id",
      data: releases,
      map: (id) => productIds.get(id) ?? null,
    }),
    destination,
    keep: ["created_at"],
    table: "product_releases",
  });

  return { productIds, releaseIds };
}

/**
 * Courses are updated in place by slug instead of being replaced, so everything that points at a
 * local course keeps its id.
 */
export async function upsertCourses({
  catalog,
  destination,
}: {
  catalog: SourceCatalog;
  destination: Client;
}): Promise<IdMap> {
  await insertRows({
    data: catalog.course_families,
    destination,
    suffix: "ON CONFLICT (id) DO NOTHING",
    table: "course_families",
  });

  return upsertRows({
    conflict: ["organization_id", "slug"],
    data: {
      ...catalog.courses,
      rows: catalog.courses.rows.map((row) => ({ ...row, user_count: "0", user_id: null })),
    },
    destination,
    keep: ["user_count", "user_id"],
    table: "courses",
  });
}

/** Learners' private language lessons share words and sentences, so they're never removed. */
export async function upsertVocabulary({
  catalog,
  destination,
  organizationId,
}: {
  catalog: SourceCatalog;
  destination: Client;
  organizationId: string;
}): Promise<{ sentenceIds: IdMap; wordIds: IdMap }> {
  const wordIds = await upsertRows({
    conflict: ["organization_id", "target_language", "word"],
    data: withOrganization({ data: catalog.words, organizationId }),
    destination,
    keep: ["created_at"],
    table: "words",
  });

  const sentenceIds = await upsertRows({
    conflict: ["organization_id", "target_language", "sentence"],
    data: withOrganization({ data: catalog.sentences, organizationId }),
    destination,
    keep: ["created_at"],
    table: "sentences",
  });

  await upsertRows({
    conflict: ["word_id", "user_language"],
    data: mapColumn({
      column: "word_id",
      data: catalog.word_pronunciations,
      map: (id) => wordIds.get(id) ?? null,
    }),
    destination,
    keep: ["created_at"],
    table: "word_pronunciations",
  });

  return { sentenceIds, wordIds };
}
