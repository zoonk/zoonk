import { pickAvailableSlug } from "@zoonk/utils/string";
import { type Client } from "pg";
import {
  type DatabaseRow,
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
 * brand takes the id and slug of the local brand with its domain, else of a local brand with its slug
 * and no domain. One whose slug a different local brand holds is a new brand with a free slug.
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
    query: "SELECT id, slug, domain FROM organizations",
  });

  const byDomain = new Map(local.rows.flatMap((row) => (row.domain ? [[row.domain, row]] : [])));
  const bySlug = new Map(local.rows.map((row) => [row.slug, row]));
  const taken = [...getColumnValues(local, "slug"), ...getColumnValues(data, "slug")];

  return {
    ...data,
    rows: data.rows.map((row) => {
      const sameSlug = bySlug.get(row.slug);

      const match =
        (row.domain && byDomain.get(row.domain)) || (sameSlug?.domain ? null : sameSlug);

      if (match) {
        return { ...row, id: match.id ?? null, slug: match.slug ?? null };
      }

      return sameSlug && row.slug
        ? { ...row, slug: pickAvailableSlug({ base: row.slug, taken }) }
        : row;
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

/**
 * Products and releases match by normalized name, yet two names can share a slug ("3.12" and "3.1.2"),
 * so each copy's suffixes depend on the order its rows were made. A local row keeps its slug, and a
 * new row whose slug another local row under the same parent holds takes a free one.
 */
async function matchLocalSlugs({
  data,
  destination,
  parent,
  table,
}: {
  data: TableRows;
  destination: Client;
  parent: "organization_id" | "product_id";
  table: "products" | "product_releases";
}): Promise<TableRows> {
  const local = await readRows({
    client: destination,
    params: [getColumnValues(data, parent)],
    query: `SELECT ${parent}, normalized_name, slug FROM ${table} WHERE ${parent} = ANY($1::uuid[])`,
  });

  const key = (row: DatabaseRow) => getRowKey(row, [parent, "normalized_name"]);
  const localSlugs = new Map(local.rows.map((row) => [key(row), row.slug]));
  const localTaken = new Set(local.rows.map((row) => getRowKey(row, [parent, "slug"])));

  const takenUnder = (parentId: string | null) =>
    [...local.rows, ...data.rows].flatMap((row) =>
      row[parent] === parentId && row.slug ? [row.slug] : [],
    );

  return {
    ...data,
    rows: data.rows.map((row) => {
      const localSlug = localSlugs.get(key(row));

      if (localSlug) {
        return { ...row, slug: localSlug };
      }

      return row.slug && localTaken.has(getRowKey(row, [parent, "slug"]))
        ? {
            ...row,
            slug: pickAvailableSlug({ base: row.slug, taken: takenUnder(row[parent] ?? null) }),
          }
        : row;
    }),
  };
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
    data: await matchLocalSlugs({
      data: products,
      destination,
      parent: "organization_id",
      table: "products",
    }),
    destination,
    keep: ["created_at"],
    table: "products",
  });

  const localReleases = mapColumn({
    column: "product_id",
    data: releases,
    map: (id) => productIds.get(id) ?? null,
  });

  const releaseIds = await upsertRows({
    conflict: ["product_id", "normalized_name"],
    data: await matchLocalSlugs({
      data: localReleases,
      destination,
      parent: "product_id",
      table: "product_releases",
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
