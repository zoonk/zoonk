import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { type ContentFeedbackFilters } from "@/data/feedback/_utils/content-feedback-where";
import { listContentFeedback } from "@/data/feedback/list-content-feedback";
import { parseSearchParams } from "@/lib/parse-search-params";
import {
  parseContentFeedbackFilters,
  toContentFeedbackQueryParams,
} from "./_utils/feedback-filters";
import { FeedbackRow } from "./feedback-row";

const columns: AdminTableColumn[] = [
  { label: "Date" },
  { label: "Content" },
  { label: "Vote" },
  { label: "Reasons" },
  { label: "Comment" },
  { label: "Language" },
  { label: "Model / prompt" },
  { label: "Learner" },
];

export async function FeedbackList({
  searchParams,
}: {
  searchParams: PageProps<"/feedback">["searchParams"];
}) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);
  const filters = parseContentFeedbackFilters(params);

  return (
    <CachedFeedbackList
      contentKind={filters.contentKind}
      limit={limit}
      model={filters.model}
      offset={offset}
      page={page}
      promptVersion={filters.promptVersion}
      reason={filters.reason}
      vote={filters.vote}
    />
  );
}

/** Filters arrive as primitives so every filtered URL gets its own private cache entry. */
async function CachedFeedbackList({
  limit,
  offset,
  page,
  ...filters
}: ContentFeedbackFilters & { limit: number; offset: number; page: number }) {
  "use cache: private";

  const { feedback, total } = await listContentFeedback({ filters, limit, offset });

  return (
    <>
      <AdminTableColumns
        columns={columns}
        emptyLabel="No votes match these filters."
        isEmpty={feedback.length === 0}
      >
        {feedback.map((row) => (
          <FeedbackRow feedback={row} key={row.id} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/feedback"
        limit={limit}
        page={page}
        queryParams={toContentFeedbackQueryParams(filters)}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function FeedbackListSkeleton() {
  return <AdminTableColumnsSkeleton columns={columns} />;
}
