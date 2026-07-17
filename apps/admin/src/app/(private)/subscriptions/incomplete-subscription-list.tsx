import { AdminTableSkeleton, AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { AdminPagination } from "@/components/pagination";
import {
  type IncompleteSubscription,
  listIncompleteSubscriptions,
} from "@/data/subscriptions/list-incomplete-subscriptions";
import { parseSearchParams } from "@/lib/parse-search-params";
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
 * The paginated list keeps subscription triage server-rendered while preserving
 * URL pagination, so admins can refresh or share a specific queue page.
 */
export async function IncompleteSubscriptionList({
  searchParams,
}: {
  searchParams: PageProps<"/subscriptions">["searchParams"];
}) {
  const params = await searchParams;
  const { limit, offset, page } = parseSearchParams(params);

  return <CachedIncompleteSubscriptionList limit={limit} offset={offset} page={page} />;
}

/**
 * Pagination primitives form a stable cache key so runtime prefetching can
 * resolve the support queue before its link is clicked.
 */
async function CachedIncompleteSubscriptionList({
  limit,
  offset,
  page,
}: {
  limit: number;
  offset: number;
  page: number;
}) {
  "use cache: private";

  const { subscriptions, total } = await listIncompleteSubscriptions({ limit, offset });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {total.toLocaleString()} incomplete subscriptions.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <IncompleteSubscriptionTableHeader />

          <TableBody>
            {subscriptions.length > 0 ? (
              subscriptions.map((subscription) => (
                <IncompleteSubscriptionRow key={subscription.id} subscription={subscription} />
              ))
            ) : (
              <IncompleteSubscriptionEmptyRow />
            )}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/subscriptions"
        limit={limit}
        page={page}
        totalPages={totalPages}
      />
    </>
  );
}

/**
 * The fallback matches the loaded table dimensions closely enough that the
 * page does not jump when the subscription query finishes streaming in.
 */
export function IncompleteSubscriptionListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-44" />

      <AdminTableSkeleton className="overflow-x-auto">
        <Table>
          <IncompleteSubscriptionTableHeader />

          <AdminTableSkeletonRows>
            <IncompleteSubscriptionSkeletonRow />
          </AdminTableSkeletonRows>
        </Table>
      </AdminTableSkeleton>
    </div>
  );
}

/**
 * The loaded table and skeleton share one header because the column labels are
 * part of the support workflow and should not drift between states.
 */
function IncompleteSubscriptionTableHeader() {
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

/**
 * Empty rows stay inside the table so the page keeps the same visual structure
 * whether the queue has work or is clear.
 */
function IncompleteSubscriptionEmptyRow() {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground" colSpan={TABLE_COLUMN_COUNT}>
        No incomplete subscriptions found.
      </TableCell>
    </TableRow>
  );
}

/**
 * A separate skeleton row keeps placeholder sizing readable and avoids hiding
 * the actual table structure behind one large generic loading block.
 */
function IncompleteSubscriptionSkeletonRow() {
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

/**
 * Each row makes the account identity the primary action because the next step
 * after spotting a stuck subscription is usually account-level support work.
 */
function IncompleteSubscriptionRow({ subscription }: { subscription: IncompleteSubscription }) {
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
      <TableCell className="capitalize">{getProviderLabel(subscription.provider)}</TableCell>
      <TableCell>
        <Badge className="capitalize" variant="secondary">
          {subscription.status ?? "—"}
        </Badge>
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

/**
 * Provider labels use product names instead of raw enum casing so the table can
 * be scanned quickly by a human doing support triage.
 */
function getProviderLabel(provider: string) {
  if (provider === "apple") {
    return "Apple";
  }

  if (provider === "google") {
    return "Google";
  }

  if (provider === "stripe") {
    return "Stripe";
  }

  return "Zoonk";
}

/**
 * Incomplete checkout rows can exist before Stripe or manual records have a
 * billing period, so missing dates should read as empty data rather than an
 * invalid or misleading timestamp.
 */
function formatOptionalDate(date: Date | null) {
  return date ? new Date(date).toLocaleDateString() : "—";
}
