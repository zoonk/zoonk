import {
  type SubscriptionFilter,
  subscriptionFilterLabels,
  subscriptionFilters,
} from "@/lib/subscription";
import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

/**
 * Route links keep subscription filters shareable and preserve server rendering
 * without adding client state to an operational admin table.
 */
export function SubscriptionStatusFilter({ status }: { status: SubscriptionFilter }) {
  return (
    <nav aria-label="Subscription status filter" className="flex flex-wrap gap-1">
      {subscriptionFilters.map((filter) => (
        <Button
          key={filter}
          nativeButton={false}
          render={
            <Link
              aria-current={status === filter ? "page" : undefined}
              href={getSubscriptionFilterHref(filter)}
              prefetch
            />
          }
          size="sm"
          variant={status === filter ? "default" : "outline"}
        >
          {subscriptionFilterLabels[filter]}
        </Button>
      ))}
    </nav>
  );
}

/** Filtering resets pagination so switching to a smaller result set cannot open an empty page. */
function getSubscriptionFilterHref(
  filter: SubscriptionFilter,
): "/subscriptions" | `/subscriptions?${string}` {
  return filter === "all" ? "/subscriptions" : `/subscriptions?status=${filter}`;
}
