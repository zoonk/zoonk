import {
  type SubscriptionFilter,
  subscriptionFilterLabels,
  subscriptionFilters,
} from "@/lib/subscription";
import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

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

function getSubscriptionFilterHref(
  filter: SubscriptionFilter,
): "/subscriptions" | `/subscriptions?${string}` {
  return filter === "all" ? "/subscriptions" : `/subscriptions?status=${filter}`;
}
