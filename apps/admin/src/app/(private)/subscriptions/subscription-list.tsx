import { AdminTableSkeleton, AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { AdminPagination } from "@/components/pagination";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { type AdminSubscription, listSubscriptions } from "@/data/subscriptions/list-subscriptions";
import { parseSearchParams } from "@/lib/parse-search-params";
import {
  getSubscriptionProviderLabel,
  getSubscriptionStatusLabel,
  parseSubscriptionFilter,
  subscriptionFilterLabels,
} from "@/lib/subscription";
import { Badge } from "@zoonk/ui/components/badge";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";

const TABLE_COLUMN_COUNT = 7;

/**
 * Subscription filters and pagination are URL state, so the complete log stays
 * server-rendered and can be refreshed or shared without losing its context.
 */
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
  filter: ReturnType<typeof parseSubscriptionFilter>;
  limit: number;
  offset: number;
  page: number;
}) {
  "use cache: private";

  const { subscriptions, total } = await listSubscriptions({ filter, limit, offset });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {getSubscriptionCountLabel({ filter, total })}
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <SubscriptionTableHeader />

          <TableBody>
            {subscriptions.length > 0 ? (
              subscriptions.map((subscription) => (
                <SubscriptionRow key={subscription.id} subscription={subscription} />
              ))
            ) : (
              <SubscriptionEmptyRow filter={filter} />
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/subscriptions"
        limit={limit}
        page={page}
        queryParams={{ status: filter === "all" ? undefined : filter }}
        totalPages={totalPages}
      />
    </>
  );
}

/** The fallback shares the real table header so loading and loaded columns cannot drift. */
export function SubscriptionListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-36" />

      <AdminTableSkeleton className="overflow-x-auto">
        <Table>
          <SubscriptionTableHeader />

          <AdminTableSkeletonRows>
            <SubscriptionSkeletonRow />
          </AdminTableSkeletonRows>
        </Table>
      </AdminTableSkeleton>
    </div>
  );
}

function SubscriptionTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>User</TableHead>
        <TableHead>Plan</TableHead>
        <TableHead>Provider</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Billing</TableHead>
        <TableHead>Period Start</TableHead>
        <TableHead>Stripe Subscription</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function SubscriptionEmptyRow({ filter }: { filter: ReturnType<typeof parseSubscriptionFilter> }) {
  const filterLabel = subscriptionFilterLabels[filter].toLowerCase();

  const message =
    filter === "all" ? "No subscriptions found." : `No ${filterLabel} subscriptions found.`;

  return (
    <TableRow>
      <TableCell className="text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
        {message}
      </TableCell>
    </TableRow>
  );
}

function SubscriptionSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-36" />
      </TableCell>
    </TableRow>
  );
}

/** User identity remains the primary action because subscription review usually leads to support work. */
function SubscriptionRow({ subscription }: { subscription: AdminSubscription }) {
  return (
    <TableRow>
      <TableCell>
        <Link className="block" href={`/users/${subscription.user.id}`} prefetch>
          <span className="font-medium">{subscription.user.name || "—"}</span>
          <span className="text-muted-foreground block text-xs">{subscription.user.email}</span>
        </Link>
      </TableCell>

      <TableCell>
        <Badge className="capitalize" variant="outline">
          {subscription.plan}
        </Badge>
      </TableCell>
      <TableCell>{getSubscriptionProviderLabel(subscription.provider)}</TableCell>
      <TableCell>
        <SubscriptionStatusBadge className="capitalize" status={subscription.status}>
          {getSubscriptionStatusLabel(subscription.status)}
        </SubscriptionStatusBadge>
      </TableCell>
      <TableCell className="capitalize">{subscription.billingInterval ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatOptionalDate(subscription.periodStart)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {subscription.stripeSubscriptionId ?? "—"}
      </TableCell>
    </TableRow>
  );
}

function getSubscriptionCountLabel({
  filter,
  total,
}: {
  filter: ReturnType<typeof parseSubscriptionFilter>;
  total: number;
}) {
  const status = filter === "all" ? "" : `${subscriptionFilterLabels[filter].toLowerCase()} `;
  const subscriptionLabel = total === 1 ? "subscription" : "subscriptions";

  return `${total.toLocaleString()} ${status}${subscriptionLabel}.`;
}

function formatOptionalDate(date: Date | null) {
  return date ? new Date(date).toLocaleDateString() : "—";
}
