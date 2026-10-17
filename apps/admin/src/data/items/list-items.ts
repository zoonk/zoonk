import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type ItemFormat, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

const cachedListItems = cacheAdminData(
  async (
    limit: number,
    offset: number,
    format?: ItemFormat,
    language?: string,
    search?: string,
  ) => {
    const where = {
      format,
      language,
      ...(search ? { skill: { normalizedName: { contains: normalizeString(search) } } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        include: {
          examBlueprint: { select: { id: true, name: true } },
          skill: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.item.count({ where }),
    ]);

    return { items, total };
  },
);

export type ListedItem = Awaited<ReturnType<typeof listItems>>["items"][number];

/**
 * Items are questions without a title of their own, so admins find them by
 * the skill they practice, then narrow by format and language.
 */
export async function listItems({
  format,
  language,
  limit,
  offset,
  search,
}: {
  format?: ItemFormat;
  language?: string;
  limit: number;
  offset: number;
  search?: string;
}) {
  return cachedListItems(limit, offset, format, language, search);
}
