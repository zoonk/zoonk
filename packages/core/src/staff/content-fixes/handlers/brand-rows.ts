import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { toNameKey } from "../../../library/products/product-keys";
import { type Json } from "../_utils/resolved-change";
import { sharedRowHandler } from "./shared-row";

const text = z.string().trim().min(1);
const date = z.iso.date().nullable();

function toDay(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  return typeof value === "string" ? new Date(value) : value;
}

async function productCourseIds(db: TransactionClient, productId: string): Promise<string[]> {
  const courses = await db.course.findMany({ select: { id: true }, where: { productId } });
  return courses.map((course) => course.id);
}

/**
 * Research and learners find a product or release by its name's key, and research saves a reading
 * under that key, so a name that changes the key would make a second row on the next reading.
 */
function keyProblem({ name, row }: { name: Json | undefined; row: Record<string, Json> }) {
  const key = row.normalizedName;

  return typeof name === "string" && name !== row.name && toNameKey(name) !== key
    ? `name must keep its lookup key ${JSON.stringify(key)}: only its case, spaces and punctuation can change, since research finds the row by it and another name would make a second row.`
    : null;
}

const productFields = { description: text, name: text, website: z.url() };

export const productSet = sharedRowHandler({
  fields: productFields,
  load: async (db, id) => {
    const [row, courseIds] = await Promise.all([
      db.product.findUnique({
        select: {
          description: true,
          name: true,
          normalizedName: true,
          organizationId: true,
          website: true,
        },
        where: { id },
      }),
      productCourseIds(db, id),
    ]);

    return (
      row && {
        roots: { courseIds },
        row: {
          description: row.description,
          name: row.name,
          normalizedName: row.normalizedName,
          website: row.website,
        },
        unit: { id, kind: "product" },
      }
    );
  },
  model: "Product",
  rules:
    "A product research saved. name may change only its case, spaces and punctuation (research and learners find it by its key). Course titles made from it keep theirs (fix them with Course set); plans studying its courses re-plan at their next planning write.",
  table: sql`products`,
  validate: (row, next) => keyProblem({ name: next.name, row }),
  write: (tx, id, values) =>
    tx.product.update({ data: z.object(productFields).partial().parse(values), where: { id } }),
});

const releaseFields = {
  name: text,
  releasedAt: date,
  releasedMonthOnly: z.boolean(),
  supportEndsAt: date,
  version: text.nullable(),
};

function releaseDateProblem(next: Record<string, Json>): string | null {
  if (!next.releasedMonthOnly) {
    return null;
  }

  return typeof next.releasedAt === "string" && next.releasedAt.endsWith("-01")
    ? null
    : "A release dated only by month has releasedAt on that month's first day.";
}

export const productReleaseSet = sharedRowHandler({
  fields: releaseFields,
  load: async (db, id) => {
    const row = await db.productRelease.findUnique({ where: { id } });

    return (
      row && {
        roots: { courseIds: await productCourseIds(db, row.productId) },
        row: {
          name: row.name,
          normalizedName: row.normalizedName,
          releasedAt: toDay(row.releasedAt),
          releasedMonthOnly: row.releasedMonthOnly,
          supportEndsAt: toDay(row.supportEndsAt),
          version: row.version,
        },
        unit: { id: row.productId, kind: "product" },
      }
    );
  },
  model: "ProductRelease",
  rules:
    "A release research saved. Dates are YYYY-MM-DD; a release dated only by month (releasedMonthOnly) has the month's first day. Its dates decide which release is current, so new goals link by them and main courses move to the release they make current. name may change only its case, spaces and punctuation. A later reading of the releases page that states a date writes it again.",
  table: sql`product_releases`,
  validate: (row, next) => keyProblem({ name: next.name, row }) ?? releaseDateProblem(next),
  write: (tx, id, values) => {
    const data = z.object(releaseFields).partial().parse(values);

    return tx.productRelease.update({
      data: {
        ...data,
        releasedAt: toDate(data.releasedAt),
        supportEndsAt: toDate(data.supportEndsAt),
      },
      where: { id },
    });
  },
});

const brandFields = { description: text, name: text, website: z.url() };

/** Research writes a brand with its measured domain and no members; Better Auth owns every other row. */
export const organizationSet = sharedRowHandler({
  fields: brandFields,
  load: async (db, id) => {
    const [row, members, courses] = await Promise.all([
      db.organization.findUnique({
        select: { description: true, domain: true, kind: true, name: true, website: true },
        where: { id },
      }),
      db.member.count({ where: { organizationId: id } }),
      db.course.findMany({ select: { id: true }, where: { organizationId: id } }),
    ]);

    return (
      row && {
        problem:
          row.kind === "brand" && row.domain !== null && members === 0
            ? undefined
            : "Only a brand research wrote (one with a domain and no members) can be fixed; accounts own the rest.",
        roots: { courseIds: courses.map((course) => course.id) },
        row: { description: row.description, name: row.name, website: row.website },
        unit: { id, kind: "organization" },
      }
    );
  },
  model: "Organization",
  rules:
    "A brand research wrote (it has a domain and no members). Its slug and domain stay, so course addresses keep working.",
  table: sql`organizations`,
  write: (tx, id, values) =>
    tx.organization.update({ data: z.object(brandFields).partial().parse(values), where: { id } }),
});
