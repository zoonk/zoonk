import "server-only";
import { type Sql, prisma, sql } from "@zoonk/db";

/**
 * The learner's first or last attempt at each item, picked in SQL: Prisma's `distinct` reads every
 * matching attempt and keeps one per item in memory. `Row` must match `columns`.
 */
export function loadAnswerPerItem<Row>({
  columns,
  order,
  userId,
  where,
}: {
  columns: Sql;
  order: "first" | "last";
  userId: string;
  where: Sql;
}): Promise<Row[]> {
  const direction = order === "first" ? sql`ASC` : sql`DESC`;

  return prisma.$queryRaw<Row[]>`
    SELECT DISTINCT ON (item_id) ${columns}
    FROM attempts
    WHERE user_id = ${userId}::uuid AND item_id IS NOT NULL AND ${where}
    ORDER BY item_id, answered_at ${direction}, id ${direction}`;
}
