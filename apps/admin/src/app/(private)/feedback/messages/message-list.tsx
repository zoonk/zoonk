import { AdminFilterNav } from "@/components/admin-filter-nav";
import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listFeedbackMessages } from "@/data/feedback/list-feedback-messages";
import { buildAdminHref } from "@/lib/admin-href";
import { buildEnumFilterOptions } from "@/lib/enum-filter-options";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type FeedbackStatus } from "@zoonk/db";
import { parseFeedbackStatus } from "../_utils/feedback-filters";
import { feedbackStatusLabels } from "../_utils/feedback-labels";
import { MessageRow } from "./message-row";

const columns: AdminTableColumn[] = [
  { label: "Date" },
  { label: "Status" },
  { label: "Sender" },
  { label: "Page" },
  { label: "Platform / version" },
  { label: "Content" },
];

export async function MessageStatusFilter({
  searchParams,
}: {
  searchParams: PageProps<"/feedback/messages">["searchParams"];
}) {
  const status = parseFeedbackStatus(await searchParams);

  return (
    <AdminFilterNav
      label="Status filter"
      options={buildEnumFilterOptions<FeedbackStatus>({
        allLabel: "All",
        buildHref: (value) =>
          buildAdminHref({ params: { status: value }, path: "/feedback/messages" }),
        current: status,
        options: [
          { label: feedbackStatusLabels.new, value: "new" },
          { label: feedbackStatusLabels.read, value: "read" },
          { label: feedbackStatusLabels.replied, value: "replied" },
        ],
      })}
    />
  );
}

export async function MessageList({
  searchParams,
}: {
  searchParams: PageProps<"/feedback/messages">["searchParams"];
}) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);

  return (
    <CachedMessageList
      limit={limit}
      offset={offset}
      page={page}
      status={parseFeedbackStatus(params)}
    />
  );
}

async function CachedMessageList({
  limit,
  offset,
  page,
  status,
}: {
  limit: number;
  offset: number;
  page: number;
  status?: FeedbackStatus;
}) {
  "use cache: private";

  const { messages, total } = await listFeedbackMessages({ limit, offset, status });

  return (
    <>
      <AdminTableColumns
        columns={columns}
        emptyLabel={status ? "No messages with this status." : "No messages yet."}
        isEmpty={messages.length === 0}
      >
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/feedback/messages"
        limit={limit}
        page={page}
        queryParams={{ status }}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function MessageListSkeleton() {
  return <AdminTableColumnsSkeleton columns={columns} />;
}
