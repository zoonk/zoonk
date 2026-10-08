import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { getVoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { getItemAnswerStats, readItemAnswerStats } from "@/data/items/get-item-answer-stats";
import { listItems } from "@/data/items/list-items";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type ItemFormat } from "@zoonk/db";
import { parseItemListFilters } from "./_utils/item-list-params";
import { ItemRow } from "./item-row";

const ITEM_COLUMNS: AdminTableColumn[] = [
  { label: "Item" },
  { label: "Skill" },
  { label: "Format" },
  { label: "Language" },
  { label: "Field" },
  { label: "Exam" },
  { align: "right", label: "Attempts" },
  { align: "right", label: "Accuracy" },
  { label: "Votes" },
  { label: "Provenance" },
  { label: "Created" },
];

/** Resolves the URL into primitive filters so each list state is its own cache entry. */
export async function ItemList({ searchParams }: Pick<PageProps<"/items">, "searchParams">) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);
  const filters = parseItemListFilters(params);

  return (
    <CachedItemList
      format={filters.format}
      language={filters.language}
      limit={limit}
      offset={offset}
      page={page}
      search={filters.search}
    />
  );
}

async function CachedItemList({
  format,
  language,
  limit,
  offset,
  page,
  search,
}: {
  format?: ItemFormat;
  language?: string;
  limit: number;
  offset: number;
  page: number;
  search?: string;
}) {
  "use cache: private";

  const { items, total } = await listItems({ format, language, limit, offset, search });
  const itemIds = items.map((item) => item.id);

  const [answerStats, voteTotals] = await Promise.all([
    getItemAnswerStats(itemIds),
    getVoteTotals({ contentIds: itemIds, contentKind: "item" }),
  ]);

  return (
    <>
      <AdminTableColumns
        columns={ITEM_COLUMNS}
        emptyLabel="No items found."
        isEmpty={items.length === 0}
      >
        {items.map((item) => (
          <ItemRow
            answerStats={readItemAnswerStats(answerStats, item.id)}
            item={item}
            key={item.id}
            votes={readVoteTotals(voteTotals, item.id)}
          />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/items"
        limit={limit}
        page={page}
        queryParams={{ format, language }}
        search={search}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function ItemListSkeleton() {
  return <AdminTableColumnsSkeleton columns={ITEM_COLUMNS} />;
}
