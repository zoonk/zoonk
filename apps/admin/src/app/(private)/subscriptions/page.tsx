import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import {
  IncompleteSubscriptionList,
  IncompleteSubscriptionListSkeleton,
} from "./incomplete-subscription-list";

export const metadata: Metadata = { title: "Incomplete Subscriptions" };
export const prefetch = "allow-runtime";

/**
 * This route gives support a focused queue of checkout records that did not
 * become active, without mixing them into the broader user or growth pages.
 */
export default function SubscriptionsPage({ searchParams }: PageProps<"/subscriptions">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Incomplete Subscriptions</ContainerTitle>
          <ContainerDescription>
            Users with subscriptions stuck in the incomplete status.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<IncompleteSubscriptionListSkeleton />}>
          <IncompleteSubscriptionList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
