import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { AdminPagination } from "@/components/pagination";
import { type AdminSubscription, listSubscriptions } from "@/data/subscriptions/list-subscriptions";
import { formatDate } from "@/lib/format";
import { parseSearchParams } from "@/lib/parse-search-params";
import {
  type SubscriptionFilter,
  getPlanLabel,
  getSubscriptionBilledBy,
  getSubscriptionStatusLabel,
  parseSubscriptionFilter,
  subscriptionFilterLabels,
} from "@/lib/subscription";
import { TableCell } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";

const COLUMNS: AdminTableColumn[] = [
  { label: "User" },
  { label: "Plan" },
  { label: "Billed by" },
  { label: "State" },
  { label: "Started" },
  { label: "Renews or ends" },
];

/** States where money stopped or never arrived, which is what staff scan this list for. */
const TROUBLE = new Set(["canceled", "incomplete_expired", "past_due", "unpaid"]);

export async function SubscriptionList({
  searchParams,
}: {
  searchParams: PageProps<"/subscriptions">["searchParams"];
}) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);
  const filter = parseSubscriptionFilter(params.status);

  return <CachedSubscriptionList filter={filter} limit={limit} offset={offset} page={page} />;
}

async function CachedSubscriptionList({
  filter,
  limit,
  offset,
  page,
}: {
  filter: SubscriptionFilter;
  limit: number;
  offset: number;
  page: number;
}) {
  "use cache: private";

  const { subscriptions, total } = await listSubscriptions({ filter, limit, offset });

  return (
    <>
      <AdminTableColumns
        columns={COLUMNS}
        emptyLabel={
          filter === "all"
            ? "No subscriptions yet."
            : `No ${subscriptionFilterLabels[filter].toLowerCase()} subscriptions.`
        }
        isEmpty={subscriptions.length === 0}
      >
        {subscriptions.map((subscription) => (
          <SubscriptionRow key={subscription.id} subscription={subscription} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/subscriptions"
        limit={limit}
        page={page}
        queryParams={{ status: filter === "all" ? undefined : filter }}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function SubscriptionListSkeleton() {
  return <AdminTableColumnsSkeleton columns={COLUMNS} />;
}

function SubscriptionRow({ subscription }: { subscription: AdminSubscription }) {
  return (
    <AdminTableRow>
      <TableCell>
        <AdminTableRowLink className="block" href={`/users/${subscription.user.id}`} prefetch>
          <span className="font-medium">{subscription.user.name || "No name"}</span>
          <span className="text-muted-foreground block text-xs">{subscription.user.email}</span>
        </AdminTableRowLink>
      </TableCell>

      <TableCell>{getPlanLabel(subscription.plan)}</TableCell>

      <TableCell>
        {getSubscriptionBilledBy(subscription)}
        {subscription.stripeSubscriptionId ? (
          <span className="text-muted-foreground block font-mono text-xs">
            {subscription.stripeSubscriptionId}
          </span>
        ) : null}
      </TableCell>

      <TableCell
        className={cn(
          subscription.status && TROUBLE.has(subscription.status) && "text-destructive-text",
        )}
      >
        {getSubscriptionStatusLabel(subscription.status)}
      </TableCell>

      <TableCell className="text-muted-foreground">
        {formatDate(subscription.periodStart)}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(subscription.periodEnd)}</TableCell>
    </AdminTableRow>
  );
}
