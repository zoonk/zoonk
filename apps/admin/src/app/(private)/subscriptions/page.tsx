import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { AdminTabs } from "@/components/admin-tabs";
import { buildAdminHref } from "@/lib/admin-href";
import {
  parseSubscriptionFilter,
  subscriptionFilterLabels,
  subscriptionFilters,
} from "@/lib/subscription";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { SubscriptionList, SubscriptionListSkeleton } from "./subscription-list";

export const metadata: Metadata = { title: "Subscriptions" };

export default function SubscriptionsPage({ searchParams }: PageProps<"/subscriptions">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Subscriptions" />

      <AdminPageBody>
        <AdminToolbar>
          <Suspense fallback={<Skeleton className="h-7.5 w-72" />}>
            <SubscriptionFilter searchParams={searchParams} />
          </Suspense>
        </AdminToolbar>

        <Suspense fallback={<SubscriptionListSkeleton />}>
          <SubscriptionList searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}

async function SubscriptionFilter({
  searchParams,
}: Pick<PageProps<"/subscriptions">, "searchParams">) {
  const params = await searchParams;
  const current = parseSubscriptionFilter(params.status);

  return (
    <AdminTabs
      label="Subscription state"
      options={subscriptionFilters.map((filter) => ({
        href: buildAdminHref({
          params: { status: filter === "all" ? undefined : filter },
          path: "/subscriptions",
        }),
        isActive: filter === current,
        label: subscriptionFilterLabels[filter],
      }))}
    />
  );
}
