import { PlusPricingSkeleton, getPlusPricingMetadata } from "@/components/pricing/plus-pricing";
import { Container, ContainerHeaderSkeleton } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { SubscriptionPlans } from "./subscription-plans";

export async function generateMetadata(): Promise<Metadata> {
  return getPlusPricingMetadata();
}

/** Subscribers and everyone else see different pages, so the wait shows neither's headline. */
function SubscriptionSkeleton() {
  return (
    <Container className="gap-8 py-4 sm:max-w-150 sm:py-8 lg:gap-10 lg:py-10">
      <ContainerHeaderSkeleton />
      <PlusPricingSkeleton />
    </Container>
  );
}

/**
 * Plus inside the app, for anyone with a session: subscribers see their plan and how to manage
 * it, signed-in learners can subscribe, and guests log in first. Visitors get the public pricing
 * page instead; the proxy sends them there before this renders.
 */
export default function Subscription({ searchParams }: PageProps<"/[lang]/subscription">) {
  return (
    <Suspense fallback={<SubscriptionSkeleton />}>
      <SubscriptionPlans searchParams={searchParams} />
    </Suspense>
  );
}
