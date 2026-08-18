import { parseSubscriptionFilter } from "@/lib/subscription";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { SubscriptionList, SubscriptionListSkeleton } from "./subscription-list";
import { SubscriptionStatusFilter } from "./subscription-status-filter";

export const metadata: Metadata = { title: "Subscriptions" };

/**
 * This route gives support one subscription lifecycle log with shareable status
 * filters instead of splitting active, canceled, and incomplete records.
 */
export default function SubscriptionsPage({ searchParams }: PageProps<"/subscriptions">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Subscriptions</ContainerTitle>
          <ContainerDescription>
            Review active, canceled, and incomplete subscription records.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<Skeleton className="h-8 w-72 rounded-4xl" />}>
          <SubscriptionFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<SubscriptionListSkeleton />}>
          <SubscriptionList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function SubscriptionFilters({
  searchParams,
}: Pick<PageProps<"/subscriptions">, "searchParams">) {
  const params = await searchParams;
  const status = parseSubscriptionFilter(params.status);

  return <SubscriptionStatusFilter status={status} />;
}
