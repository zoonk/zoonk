import { type Client } from "pg";
import { type TableRows, getRowKey, getUpsertClause, insertRows, mapColumn } from "./rows";
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
 * Courses are updated in place by slug instead of being replaced, so everything that points at a
 * local course keeps its id.
 */
export async function upsertCourses({
  catalog,
  destination,
  organizationId,
}: {
  catalog: SourceCatalog;
  destination: Client;
  organizationId: string;
}): Promise<IdMap> {
  await insertRows({
    data: catalog.course_families,
    destination,
    suffix: "ON CONFLICT (id) DO NOTHING",
    table: "course_families",
  });

  const courses = withOrganization({ data: catalog.courses, organizationId });

  return upsertRows({
    conflict: ["organization_id", "slug"],
    data: {
      ...courses,
      rows: courses.rows.map((row) => ({ ...row, user_count: "0", user_id: null })),
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
