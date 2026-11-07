import { pickAvailableSlug } from "@zoonk/utils/string";
import { type Client } from "pg";
import { type DatabaseRow, type TableRows, getColumnValues, getRowKey, readRows } from "./rows";
import { type SourceCatalog } from "./source";

const PRODUCT_COURSE = ["organization_id", "product", "language", "is_pinned", "release"];
const SLUG = ["organization_id", "slug"];

function getNames(data: TableRows): Map<string | null, string | null> {
  return new Map(data.rows.map((row) => [row.id ?? null, row.normalized_name ?? null]));
}

/**
 * A product's course is its product, language and, when pinned, release, yet pinned courses for
 * releases whose names share a slug get their suffixes in the order each copy made them. A local
 * product course keeps its slug, so the update by slug lands on it. Any other course whose slug a
 * local product course holds, and a new product course whose slug any local course holds, takes a
 * free one. Run it before anything matches courses by slug.
 */
export async function matchLocalCourses({
  catalog,
  destination,
}: {
  catalog: SourceCatalog;
  destination: Client;
}): Promise<SourceCatalog> {
  const local = await readRows({
    client: destination,
    params: [getColumnValues(catalog.courses, "organization_id")],
    query: `SELECT courses.organization_id, courses.slug, courses.language, courses.is_pinned,
                   products.normalized_name AS product, releases.normalized_name AS release
              FROM courses
              LEFT JOIN products ON products.id = courses.product_id
              LEFT JOIN product_releases releases
                ON releases.id = courses.product_release_id AND courses.is_pinned
             WHERE courses.organization_id = ANY($1::uuid[])`,
  });

  const productNames = getNames(catalog.products);
  const releaseNames = getNames(catalog.product_releases);

  const withNames = (row: DatabaseRow): DatabaseRow => ({
    ...row,
    product: productNames.get(row.product_id ?? null) ?? null,
    release:
      row.is_pinned === "t" ? (releaseNames.get(row.product_release_id ?? null) ?? null) : null,
  });

  const localProductSlugs = new Map(
    local.rows.flatMap((row) => (row.product ? [[getRowKey(row, PRODUCT_COURSE), row.slug]] : [])),
  );

  const localHolders = new Map(local.rows.map((row) => [getRowKey(row, SLUG), row]));

  const takenIn = (organizationId: string | null) =>
    [...local.rows, ...catalog.courses.rows].flatMap((row) =>
      row.organization_id === organizationId && row.slug ? [row.slug] : [],
    );

  const rows = catalog.courses.rows.map((row) => {
    const named = withNames(row);
    const localSlug = named.product && localProductSlugs.get(getRowKey(named, PRODUCT_COURSE));

    if (localSlug) {
      return { ...row, slug: localSlug };
    }

    const holder = localHolders.get(getRowKey(row, SLUG));

    return row.slug && holder && (named.product || holder.product)
      ? {
          ...row,
          slug: pickAvailableSlug({ base: row.slug, taken: takenIn(row.organization_id ?? null) }),
        }
      : row;
  });

  return { ...catalog, courses: { ...catalog.courses, rows } };
}
