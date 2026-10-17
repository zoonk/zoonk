import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type ContentCreatedSqlRow, toDailyContentRows } from "@/data/stats/_utils/content-created";
import { getLibraryContentCreatedSql } from "@/data/stats/_utils/library-content-created-sql";
import { prisma } from "@zoonk/db";

/** Library content created per day, with every content type as a column. */
export const getDailyContentCreated = cacheAdminData(async (start: Date, end: Date) => {
  const rows = await prisma.$queryRaw<ContentCreatedSqlRow[]>(
    getLibraryContentCreatedSql({ end, start }),
  );

  return toDailyContentRows(rows);
});
