import { AdminTabs } from "@/components/admin-tabs";
import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listFeedbackMessages } from "@/data/feedback/list-feedback-messages";
import { getInbox } from "@/data/inbox/get-inbox";
import { buildAdminHref } from "@/lib/admin-href";
import { parseSearchParams } from "@/lib/parse-search-params";
import {
  FEEDBACK_FILTERS,
  type FeedbackFilter,
  parseFeedbackFilter,
  toFeedbackStatus,
} from "../_utils/feedback-filters";
import { MessageRow } from "./message-row";

const FILTER_LABELS: Record<FeedbackFilter, string> = {
  all: "All",
  new: "New",
  read: "Read",
  replied: "Replied",
};

const EMPTY_LABELS: Record<FeedbackFilter, string> = {
  all: "No messages yet.",
  new: "No new messages.",
  read: "No read messages.",
  replied: "No replied messages.",
};

function messageColumns(filter: FeedbackFilter): AdminTableColumn[] {
  return [
    { label: "From" },
    { label: "About" },
    { label: "App" },
    { label: "Sent" },
    ...(filter === "all" ? [{ label: "State" }] : []),
  ];
}

function filterHref(filter: FeedbackFilter) {
  return buildAdminHref({
    params: { status: filter === "new" ? undefined : filter },
    path: "/feedback/messages",
  });
}

export async function MessageFilter({
  searchParams,
}: {
  searchParams: PageProps<"/feedback/messages">["searchParams"];
}) {
  const [params, inbox] = await Promise.all([searchParams, getInbox()]);
  const current = parseFeedbackFilter(params);

  return (
    <AdminTabs
      label="Messages"
      options={FEEDBACK_FILTERS.map((filter) => ({
        count: filter === "new" ? inbox.feedback.count : undefined,
        href: filterHref(filter),
        isActive: filter === current,
        label: FILTER_LABELS[filter],
      }))}
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
  const filter = parseFeedbackFilter(params);

  const { messages, total } = await listFeedbackMessages({
    limit,
    offset,
    status: toFeedbackStatus(filter),
  });

  return (
    <>
      <AdminTableColumns
        columns={messageColumns(filter)}
        emptyLabel={EMPTY_LABELS[filter]}
        isEmpty={messages.length === 0}
      >
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} showState={filter === "all"} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/feedback/messages"
        limit={limit}
        page={page}
        queryParams={{ status: filter === "new" ? undefined : filter }}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function MessageListSkeleton() {
  return <AdminTableColumnsSkeleton columns={messageColumns("new")} />;
}
