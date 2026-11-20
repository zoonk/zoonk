import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { ITEM_PROMPT_KEYS } from "@/lib/item-label";
import { type ItemFormat, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

/** A question's own words: its `question`, or the claim a true-or-false one states. */
function promptContains(search: string) {
  return ITEM_PROMPT_KEYS.map((key) => ({
    content: { mode: "insensitive" as const, path: [key], string_contains: search },
  }));
}

function skillNameContains(search: string) {
  return { skill: { normalizedName: { contains: normalizeString(search) } } };
}

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
      ...(search ? { OR: [...promptContains(search), skillNameContains(search)] } : {}),
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
