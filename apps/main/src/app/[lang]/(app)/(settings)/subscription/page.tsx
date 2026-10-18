import { PlusPricingSkeleton, getPlusPricingMetadata } from "@/components/pricing/plus-pricing";
import { Page } from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { SubscriptionPlans } from "./subscription-plans";

export async function generateMetadata(): Promise<Metadata> {
  return getPlusPricingMetadata();
}

/** Subscribers and everyone else see different pages, so the wait shows neither's headline. */
function SubscriptionSkeleton() {
  return (
    <Page aria-hidden="true">
      <Skeleton className="mx-1 h-9 w-64 max-w-full md:h-6.5" />
      <PlusPricingSkeleton />
    </Page>
  );
}

/**
 * Plus inside the app: subscribers see their plan and how to manage it, signed-in learners can
 * subscribe, guests log in first, and visitors log in or start free.
 */
export default function Subscription({ searchParams }: PageProps<"/[lang]/subscription">) {
  return (
    <Suspense fallback={<SubscriptionSkeleton />}>
      <SubscriptionPlans searchParams={searchParams} />
    </Suspense>
  );
}
